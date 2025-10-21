#!/usr/bin/env -S uv run --quiet --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "rich>=13.0.0",
# ]
# ///

"""
run_evaluation.py - Evaluate web researcher skill with different prompt variants

Tests query/prompt combinations to find optimal balance between quality and latency.
"""

import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

console = Console()

# Define prompt variations
# NOTE: "concise" is now the recommended default (as of 2025-10-20 evaluation)
PROMPTS = {
    "concise": "Provide practical technical guidance for AI coding assistants. When multiple approaches exist, explain key tradeoffs. Include concrete code examples. Prioritize actionable information.",

    "minimal": "Provide clear, practical technical guidance. Include code examples when relevant.",

    "medium": "Provide practical technical guidance for AI coding assistants. Include code examples and explain key tradeoffs when multiple approaches exist.",

    "comprehensive": """Provide comprehensive technical guidance for AI coding assistants.

When multiple approaches exist, analyze pros/cons and tradeoffs explicitly. Include concrete code examples with explanations showing real-world implementation patterns. Address security considerations and performance implications relevant to the topic. Call out common pitfalls and mistakes to avoid. For technology comparisons or decisions, provide clear criteria for choosing between options.

Organize your response clearly with section headers, but adapt the structure naturally to the question type. Prioritize actionable, practical information over theoretical concepts.""",
}

# Define test queries by category
TEST_QUERIES = {
    "quick_reference": [
        "What is the syntax for Python list comprehensions?",
        "Default port for PostgreSQL?",
        "How to export a named export in TypeScript?",
    ],
    "version_features": [
        "What's new in TypeScript 5.5?",
        "Breaking changes in React 19?",
        "New features in Python 3.13?",
    ],
    "architecture_design": [
        "How to structure authentication in microservices architecture?",
        "Best practices for designing a scalable API gateway?",
        "How to architect a real-time chat application?",
    ],
    "technology_comparison": [
        "GraphQL vs REST API for mobile backends?",
        "Redis vs Memcached for session storage?",
        "PostgreSQL vs MongoDB for social media app?",
    ],
    "implementation_guides": [
        "How to implement OAuth2 in Express.js?",
        "Setting up WebSocket connections in FastAPI?",
        "Implementing rate limiting in a Node.js API?",
    ],
    "debugging": [
        "How to debug memory leaks in Node.js?",
        "Troubleshooting slow PostgreSQL queries?",
        "Debugging React render performance issues?",
    ],
}


def run_search(query: str, prompt_name: str, system_prompt: str, category: str) -> dict:
    """Run a single websearch with benchmarking and return metrics."""
    script_path = Path(__file__).parent.parent / "scripts" / "websearch"

    try:
        # Run websearch with --benchmark flag
        result = subprocess.run(
            [
                str(script_path),
                "--benchmark",
                "--system", system_prompt,
                query
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        # Parse benchmark JSON from stderr (last line should be the JSON)
        benchmark_data = None
        stderr_lines = result.stderr.strip().split('\n')

        # Try last line first (most likely), then work backwards
        for line in reversed(stderr_lines):
            if line.strip():
                try:
                    benchmark_data = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue

        if benchmark_data is None:
            return {
                "query": query,
                "category": category,
                "prompt_name": prompt_name,
                "success": False,
                "error": "No benchmark data found",
            }

        # Add metadata
        benchmark_data["category"] = category
        benchmark_data["prompt_name"] = prompt_name
        benchmark_data["success"] = result.returncode == 0
        benchmark_data["error"] = None if result.returncode == 0 else result.stderr

        return benchmark_data

    except subprocess.TimeoutExpired:
        return {
            "query": query,
            "category": category,
            "prompt_name": prompt_name,
            "success": False,
            "error": "Timeout (>60s)",
        }
    except Exception as e:
        return {
            "query": query,
            "category": category,
            "prompt_name": prompt_name,
            "success": False,
            "error": str(e),
        }


@click.command()
@click.option(
    "--name",
    "-n",
    default="eval",
    help="Short name for this evaluation run (1-4 words, e.g. 'prompt-variants')",
)
def main(name):
    """Run full evaluation suite."""
    console.print("[bold blue]Web Researcher Skill Evaluation[/bold blue]\n")

    # Calculate total tests
    total_queries = sum(len(queries) for queries in TEST_QUERIES.values())
    total_tests = total_queries * len(PROMPTS)

    console.print(f"[cyan]Total queries: {total_queries}[/cyan]")
    console.print(f"[cyan]Prompt variations: {len(PROMPTS)}[/cyan]")
    console.print(f"[cyan]Total tests: {total_tests}[/cyan]\n")

    # Prepare all test configurations
    test_configs = []
    for category, queries in TEST_QUERIES.items():
        for query in queries:
            for prompt_name, system_prompt in PROMPTS.items():
                test_configs.append((query, prompt_name, system_prompt, category))

    # Run tests in parallel
    results = []
    max_workers = 6  # Run 6 tests concurrently

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:

        task = progress.add_task("[cyan]Running evaluations...", total=total_tests)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            futures = {
                executor.submit(run_search, query, prompt_name, system_prompt, category): (category, prompt_name, query)
                for query, prompt_name, system_prompt, category in test_configs
            }

            # Collect results as they complete
            for future in as_completed(futures):
                category, prompt_name, query = futures[future]
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                except Exception as e:
                    console.print(f"[red]Unexpected error: {e}[/red]")

                progress.advance(task)

    # Save results to runs/{timestamp}-{name}/ directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = Path(__file__).parent / "runs" / f"{timestamp}-{name}"
    run_dir.mkdir(parents=True, exist_ok=True)

    results_file = run_dir / "results.json"

    with open(results_file, "w") as f:
        json.dump({
            "timestamp": timestamp,
            "total_tests": total_tests,
            "successful_tests": len(results),
            "prompts": {name: len(prompt) for name, prompt in PROMPTS.items()},
            "results": results,
        }, f, indent=2)

    console.print(f"\n[bold green]✓ Results saved to: {results_file}[/bold green]")
    console.print(f"[green]Successfully completed: {len(results)}/{total_tests} tests[/green]")

    # Print quick summary stats
    console.print("\n[bold blue]Quick Summary by Prompt Variant:[/bold blue]")

    for prompt_name in PROMPTS.keys():
        prompt_results = [r for r in results if r["prompt_name"] == prompt_name]
        if prompt_results:
            avg_latency = sum(r["total_time"] for r in prompt_results) / len(prompt_results)
            avg_ttft = sum(r["ttft"] for r in prompt_results) / len(prompt_results)
            avg_tokens = sum(r["output_tokens"] for r in prompt_results) / len(prompt_results)

            console.print(f"\n[cyan]{prompt_name}:[/cyan]")
            console.print(f"  Avg latency: {avg_latency:.2f}s")
            console.print(f"  Avg TTFT: {avg_ttft:.2f}s")
            console.print(f"  Avg output tokens: {avg_tokens:.0f}")


if __name__ == "__main__":
    main()
