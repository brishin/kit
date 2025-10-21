# Skill Evaluator

A Claude Code skill for designing and running systematic evaluations of skills.

## Purpose

The Skill Evaluator helps you make data-driven improvements to your Claude Code skills by:

- **Designing** comprehensive test plans with variations and test cases
- **Generating** custom evaluation code tailored to what you're testing
- **Executing** parallel evaluations efficiently
- **Analyzing** results with statistical rigor
- **Recommending** improvements based on quantitative and qualitative data

## When to Use

Use this skill when you need to:

- ✅ Optimize skill performance (latency, token efficiency)
- ✅ Compare different approaches (prompts, flags, models)
- ✅ Make data-driven decisions about skill changes
- ✅ Validate that improvements don't sacrifice quality
- ✅ Document optimization rationale for future reference

## Example: Web Researcher Prompt Optimization

The web-researcher skill was optimized using this methodology:

**Before:** 644-character comprehensive default prompt
**After:** 184-character concise prompt
**Results:** 33% faster, 34% fewer tokens, quality maintained
**Evidence:** 72 tests (18 queries × 4 prompt variants)

See: `skills/web-researcher/eval/` for the full evaluation.

## Quick Start

### 1. Invoke the Skill

In Claude Code, invoke the skill-evaluator when planning an optimization:

```
User: "I want to optimize my web-researcher skill's default prompt"
Agent: [Invokes skill-evaluator skill]
```

The skill will guide you through:
1. Defining your optimization goal
2. Identifying what to test (variations)
3. Creating representative test cases
4. Choosing metrics to collect
5. Setting decision criteria

### 2. Review Generated Files

The skill generates custom code tailored to your evaluation:

```
your-skill/
  eval/
    eval-config.yaml          # Evaluation definition
    run_evaluation.py         # Custom test runner for your tool
    analyze_results.py        # Statistical analyzer
    review_samples.py         # Quality assessment tool (optional)
```

The code is generated specifically for what you're testing - not from rigid templates.

### 3. Review Generated Code

The generated `run_evaluation.py` includes a `run_test()` function already customized for your use case:

- **CLI tool with --benchmark?** Calls via subprocess, parses JSON from stderr
- **API testing?** Makes HTTP requests, extracts response metrics
- **Prompt variations?** Calls tool with different system prompts
- **Model comparison?** Tests queries across different models

Review and adjust if needed, but it should work out of the box for most cases.

### 4. Run the Evaluation

```bash
cd your-skill
uv run eval/run_evaluation.py --name descriptive-name
```

Results are saved to `eval/runs/{timestamp}-{name}/results.json`

### 5. Analyze Results

```bash
uv run eval/analyze_results.py
```

Generates:
- `analysis.md` - Statistical analysis with tables
- `samples.json` - Selected outputs for quality review

### 6. Quality Review (Manual)

```bash
uv run eval/review_samples.py
```

Interactive CLI that shows samples and prompts for quality scores.

### 7. Make Recommendations

Based on quantitative + qualitative data, generate `eval/RECOMMENDATIONS.md` documenting:
- Findings
- Tradeoff analysis
- Recommended changes
- Implementation steps

## Evaluation Patterns

### Pattern 1: Prompt Optimization

**Goal:** Find optimal balance of quality and latency for system prompts.

**Config Example:**
```yaml
variations:
  - name: "minimal"
    type: "prompt"
    value: "Brief technical guidance with examples."
  - name: "balanced"
    type: "prompt"
    value: "Practical guidance. Explain tradeoffs. Include examples."
  - name: "comprehensive"
    type: "prompt"
    value: "Comprehensive guidance with pros/cons, security, pitfalls..."

metrics:
  quantitative: [total_time, ttft, output_tokens]
  qualitative: [completeness, relevance, code_quality]

decision_criteria:
  latency_improvement_threshold: 25.0
  quality_threshold: 4.0
```

### Pattern 2: Model Comparison

**Goal:** Choose best model for the use case.

**Config Example:**
```yaml
variations:
  - name: "gpt-4o"
    type: "model"
    value: "gpt-4o"
  - name: "claude-sonnet"
    type: "model"
    value: "claude-sonnet-4"
  - name: "gemini-flash"
    type: "model"
    value: "gemini-2.5-flash"

metrics:
  quantitative: [total_time, cost_per_query, output_tokens]
  qualitative: [accuracy, helpfulness, format_adherence]
```

### Pattern 3: Feature Flag Testing

**Goal:** Measure impact of new feature or flag.

**Config Example:**
```yaml
variations:
  - name: "baseline"
    type: "flag"
    value: ""
  - name: "with-citations"
    type: "flag"
    value: "--enable-citations"
  - name: "with-search"
    type: "flag"
    value: "--enable-web-search"
```

## Code Generation Approach

The skill generates evaluation code tailored to your specific needs by:

1. **Understanding your use case** through targeted questions
2. **Analyzing similar evaluations** (e.g., web-researcher as reference)
3. **Generating custom code** that fits your tool's interface and metrics
4. **Adapting patterns** to your specific requirements

### Key Generation Principles

**Flexibility over Templates:**
- Each evaluation is unique - code adapts to what's being tested
- No rigid templates that constrain implementation
- Look at existing evaluations (like web-researcher) for patterns
- Generate readable, maintainable code with clear comments

**Common Patterns:**
- **Parallel execution:** ThreadPoolExecutor with 4-8 workers
- **Progress tracking:** Rich progress bars
- **Structured output:** JSON with timestamps and metadata
- **Error handling:** Graceful timeouts and failure capture
- **Statistical analysis:** Mean, median, stdev, ranges
- **Stratified sampling:** Smart sample selection for quality review

### Example Customizations

**For CLI tools:**
```python
# Calls your tool via subprocess, parses output/metrics
result = subprocess.run([tool_path, *flags], ...)
```

**For APIs:**
```python
# Makes HTTP requests, extracts response metrics
response = client.post(url, json={...})
metrics = extract_from_response(response)
```

**For prompt testing:**
```python
# Calls same tool with different system prompts
result = call_with_prompt(test_case, variation["value"])
```

## Best Practices

### Test Case Design

✅ **DO:**
- Cover all major use cases (3-5 per category)
- Include simple, medium, complex examples
- Use real-world queries from actual usage
- Balance categories evenly

❌ **DON'T:**
- Use synthetic/artificial test cases
- Over-represent edge cases
- Create biased test sets
- Test too many variations (stick to 3-5)

### Metrics Selection

✅ **DO:**
- Focus on metrics that matter to users
- Include both quantitative and qualitative
- Define clear quality rubrics
- Set realistic decision thresholds

❌ **DON'T:**
- Optimize for vanity metrics
- Ignore quality for speed
- Skip manual quality review
- Trust quantitative data alone

### Analysis Rigor

✅ **DO:**
- Report variance (stdev, ranges)
- Identify and investigate outliers
- Use stratified sampling for quality review
- Document all findings (not just favorable ones)

❌ **DON'T:**
- Cherry-pick results
- Ignore failures
- Skip quality validation
- Over-generalize from small samples

## File Structure

After running an evaluation, you'll have:

```
your-skill/
  eval/
    eval-config.yaml
    run_evaluation.py
    analyze_results.py
    review_samples.py
    RECOMMENDATIONS.md
    runs/
      20251020_143022-prompt-optimization/
        results.json          # Raw test results
        analysis.md          # Statistical analysis
        samples.json         # Selected samples
        quality_reviews.json # Manual quality scores (if reviewed)
```

## Integration with Skills

Evaluations become part of your skill's documentation:

1. **Document optimizations** in RECOMMENDATIONS.md
2. **Reference in skill documentation** (e.g., "optimized based on 72-test evaluation")
3. **Version control runs/** for reproducibility
4. **Link to eval data** when making optimization claims

Example from web-researcher:
> "This concise default was optimized in Oct 2025 based on evaluation of 72 queries across diverse task types. It provides 33% faster response times vs previous comprehensive prompt. For details, see eval/RECOMMENDATIONS.md."

## Advanced Usage

### Custom Metrics

Add skill-specific metrics to `run_test()`:

```python
def run_test(...):
    # ... run test ...

    # Custom metric: check for code blocks
    code_blocks = len(re.findall(r'```', result.stdout))

    return {
        "total_time": total_time,
        "code_blocks_count": code_blocks,  # custom metric
        # ... other metrics
    }
```

### Iterative Refinement

1. Run initial evaluation → identify baseline
2. Design improvement → create new variation
3. Re-run evaluation → compare to baseline
4. Iterate until decision criteria met

### A/B Testing in Production

Use evaluation framework for production A/B tests:
1. Deploy multiple variations
2. Collect metrics from real usage
3. Analyze with same statistical tools
4. Make data-driven rollout decisions

## Examples

See complete examples in:
- `skills/web-researcher/eval/` - Prompt optimization (4 variants, 18 queries)

## Philosophy

**Data-Driven Decisions:** Every optimization should be backed by quantitative data and qualitative validation.

**Reproducible Science:** Evaluations should be version-controlled, documented, and repeatable.

**Flexible Methodology:** The five-phase process is constant, but the code adapts to each unique evaluation.

**Quality + Performance:** Optimize for the right balance - never sacrifice critical quality for marginal performance gains.

## Reference Implementation

See `skills/web-researcher/eval/` for a complete reference:
- 72 tests (18 queries × 4 prompt variants)
- Custom run_evaluation.py for CLI tool with --benchmark flag
- Statistical analysis with comparative tables
- 33% latency improvement while maintaining quality
- Fully documented in RECOMMENDATIONS.md

Use this as inspiration when generating evaluation code for other skills.