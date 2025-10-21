#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "rich>=13.0.0",
#     "click>=8.0.0",
# ]
# ///

"""
analyze_results.py - Analyze web researcher evaluation results

Generates comprehensive analysis of quality vs latency tradeoffs.
"""

import json
import statistics
import sys
from pathlib import Path
from typing import Dict, List

import click
from rich.console import Console
from rich.table import Table
from rich.markdown import Markdown

console = Console()


def load_results(results_file: Path) -> dict:
    """Load results from JSON file."""
    with open(results_file) as f:
        return json.load(f)


def calculate_stats(values: List[float]) -> dict:
    """Calculate statistics for a list of values."""
    if not values:
        return {"mean": 0, "median": 0, "min": 0, "max": 0, "stdev": 0}

    return {
        "mean": statistics.mean(values),
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
        "stdev": statistics.stdev(values) if len(values) > 1 else 0,
    }


def analyze_by_prompt(results: List[dict]) -> dict:
    """Analyze results grouped by prompt variant."""
    by_prompt = {}

    for result in results:
        if not result.get("success", False):
            continue

        prompt_name = result["prompt_name"]
        if prompt_name not in by_prompt:
            by_prompt[prompt_name] = {
                "total_time": [],
                "ttft": [],
                "input_tokens": [],
                "output_tokens": [],
                "char_length": [],
            }

        by_prompt[prompt_name]["total_time"].append(result["total_time"])
        by_prompt[prompt_name]["ttft"].append(result["ttft"])
        by_prompt[prompt_name]["input_tokens"].append(result["input_tokens"])
        by_prompt[prompt_name]["output_tokens"].append(result["output_tokens"])
        by_prompt[prompt_name]["char_length"].append(result["char_length"])

    # Calculate stats for each prompt
    stats_by_prompt = {}
    for prompt_name, metrics in by_prompt.items():
        stats_by_prompt[prompt_name] = {
            metric: calculate_stats(values)
            for metric, values in metrics.items()
        }

    return stats_by_prompt


def analyze_by_category(results: List[dict]) -> dict:
    """Analyze results grouped by query category."""
    by_category = {}

    for result in results:
        if not result.get("success", False):
            continue

        category = result["category"]
        prompt_name = result["prompt_name"]

        if category not in by_category:
            by_category[category] = {}

        if prompt_name not in by_category[category]:
            by_category[category][prompt_name] = {
                "total_time": [],
                "ttft": [],
                "output_tokens": [],
            }

        by_category[category][prompt_name]["total_time"].append(result["total_time"])
        by_category[category][prompt_name]["ttft"].append(result["ttft"])
        by_category[category][prompt_name]["output_tokens"].append(result["output_tokens"])

    # Calculate stats for each category/prompt combination
    stats_by_category = {}
    for category, prompts in by_category.items():
        stats_by_category[category] = {}
        for prompt_name, metrics in prompts.items():
            stats_by_category[category][prompt_name] = {
                metric: calculate_stats(values)
                for metric, values in metrics.items()
            }

    return stats_by_category


def generate_report(data: dict, stats_by_prompt: dict, stats_by_category: dict) -> str:
    """Generate markdown analysis report."""
    report = []

    report.append("# Web Researcher Skill Evaluation Results\n")
    report.append(f"**Timestamp:** {data['timestamp']}\n")
    report.append(f"**Total Tests:** {data['successful_tests']}/{data['total_tests']}\n")

    # Overall comparison by prompt
    report.append("\n## Overall Performance by Prompt Variant\n")

    table = Table(title="Latency and Token Metrics")
    table.add_column("Prompt", style="cyan")
    table.add_column("Avg Latency (s)", justify="right")
    table.add_column("Avg TTFT (s)", justify="right")
    table.add_column("Avg Output Tokens", justify="right")
    table.add_column("Avg Char Length", justify="right")

    prompt_order = ["minimal", "concise", "medium", "comprehensive"]
    baseline = stats_by_prompt.get("comprehensive", {}).get("total_time", {}).get("mean", 0)
    # Fallback to "default" for old results
    if baseline == 0:
        baseline = stats_by_prompt.get("default", {}).get("total_time", {}).get("mean", 0)

    for prompt_name in prompt_order:
        if prompt_name not in stats_by_prompt:
            continue

        stats = stats_by_prompt[prompt_name]
        latency = stats["total_time"]["mean"]
        ttft = stats["ttft"]["mean"]
        tokens = stats["output_tokens"]["mean"]
        chars = stats["char_length"]["mean"]

        improvement = ""
        if baseline and prompt_name not in ["comprehensive", "default"]:
            pct = ((baseline - latency) / baseline) * 100
            improvement = f" ({pct:+.1f}%)"

        table.add_row(
            prompt_name,
            f"{latency:.2f}{improvement}",
            f"{ttft:.2f}",
            f"{tokens:.0f}",
            f"{chars:.0f}",
        )

    console.print(table)
    report.append("\n### Key Findings\n")

    # Calculate improvements (support both old "default" and new "comprehensive" naming)
    baseline_name = "comprehensive" if "comprehensive" in stats_by_prompt else "default"

    if baseline_name in stats_by_prompt and "minimal" in stats_by_prompt:
        baseline_lat = stats_by_prompt[baseline_name]["total_time"]["mean"]
        minimal_lat = stats_by_prompt["minimal"]["total_time"]["mean"]
        improvement = ((baseline_lat - minimal_lat) / baseline_lat) * 100

        report.append(f"- **Minimal** prompt is {improvement:.1f}% faster than {baseline_name}\n")

    if baseline_name in stats_by_prompt and "concise" in stats_by_prompt:
        baseline_lat = stats_by_prompt[baseline_name]["total_time"]["mean"]
        concise_lat = stats_by_prompt["concise"]["total_time"]["mean"]
        improvement = ((baseline_lat - concise_lat) / baseline_lat) * 100

        report.append(f"- **Concise** prompt is {improvement:.1f}% faster than {baseline_name}\n")

    # Performance by category
    report.append("\n## Performance by Query Category\n")

    for category in ["quick_reference", "version_features", "implementation_guides", "architecture_design"]:
        if category not in stats_by_category:
            continue

        report.append(f"\n### {category.replace('_', ' ').title()}\n")

        cat_table = Table(title=category.replace('_', ' ').title())
        cat_table.add_column("Prompt", style="cyan")
        cat_table.add_column("Avg Latency (s)", justify="right")
        cat_table.add_column("Avg Tokens", justify="right")

        for prompt_name in prompt_order:
            if prompt_name not in stats_by_category[category]:
                continue

            stats = stats_by_category[category][prompt_name]
            latency = stats["total_time"]["mean"]
            tokens = stats["output_tokens"]["mean"]

            cat_table.add_row(
                prompt_name,
                f"{latency:.2f}",
                f"{tokens:.0f}",
            )

        console.print(cat_table)

    # Recommendations
    report.append("\n## Recommendations\n")
    report.append("\n### Optimal Prompt Selection\n")

    # Find fastest prompt
    fastest = min(stats_by_prompt.items(), key=lambda x: x[1]["total_time"]["mean"])
    report.append(f"- **Fastest overall:** {fastest[0]} ({fastest[1]['total_time']['mean']:.2f}s avg)\n")

    # Analyze token efficiency
    baseline_name = "comprehensive" if "comprehensive" in stats_by_prompt else "default"
    if baseline_name in stats_by_prompt:
        baseline_tokens = stats_by_prompt[baseline_name]["output_tokens"]["mean"]
        report.append(f"- **{baseline_name.title()} generates:** {baseline_tokens:.0f} tokens on average\n")

    report.append("\n### Next Steps\n")
    report.append("1. Manually review sample outputs for quality assessment\n")
    report.append("2. Compare response completeness across prompt variants\n")
    report.append("3. Identify optimal prompt for each query category\n")
    report.append("4. Update SKILL.md with findings\n")

    return "".join(report)


@click.command()
@click.option(
    "--run",
    "-r",
    help="Specific run directory to analyze (e.g. '20251020_220625-prompt-variants'). Defaults to most recent.",
)
def main(run):
    """Analyze evaluation results and generate report."""
    eval_dir = Path(__file__).parent
    runs_dir = eval_dir / "runs"

    if not runs_dir.exists():
        console.print("[red]No runs/ directory found. Run run_evaluation.py first.[/red]")
        sys.exit(1)

    # Find run directory
    if run:
        run_dir = runs_dir / run
        if not run_dir.exists():
            console.print(f"[red]Run directory not found: {run}[/red]")
            sys.exit(1)
    else:
        # Find most recent run
        run_dirs = sorted(runs_dir.glob("*/"), reverse=True)
        if not run_dirs:
            console.print("[red]No run directories found. Run run_evaluation.py first.[/red]")
            sys.exit(1)
        run_dir = run_dirs[0]

    results_file = run_dir / "results.json"
    if not results_file.exists():
        console.print(f"[red]No results.json found in {run_dir.name}[/red]")
        sys.exit(1)

    console.print(f"[cyan]Analyzing results from: {run_dir.name}[/cyan]\n")

    # Load and analyze
    data = load_results(results_file)
    results = data["results"]

    # Filter successful results
    successful = [r for r in results if r.get("success", False)]
    console.print(f"[green]Successful tests: {len(successful)}/{len(results)}[/green]\n")

    # Analyze
    stats_by_prompt = analyze_by_prompt(successful)
    stats_by_category = analyze_by_category(successful)

    # Generate report
    report_md = generate_report(data, stats_by_prompt, stats_by_category)

    # Save report to same run directory
    report_file = run_dir / "analysis.md"
    with open(report_file, "w") as f:
        f.write(report_md)

    console.print(f"\n[bold green]✓ Analysis report saved to: {report_file}[/bold green]")


if __name__ == "__main__":
    main()
