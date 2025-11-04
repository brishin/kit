---
name: Log-Based Debugger
description: Solves tricky bugs by strategically placing log statements with unique greppable prefixes, then analyzing program state through captured output. Use when debugging complex control flow, race conditions, state mutations, or issues where traditional debugging is difficult. Supports both manual and autonomous log retrieval.
allowed-tools:
  - Read
  - Edit
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

# Workflow

### 1. Read Code & Generate Prefix
```bash
DEBUG_<RANDOM>  # e.g., DEBUG_K9P2M
```

### 2. Add Strategic Logs
Target: function entry/exit, state mutations, branches, loops, error paths.
```python
print(f"DEBUG_K9P2M | context: {var}", file=sys.stderr)
```

### 3. Ask Retrieval Method
Detect project type (package.json, pytest.ini, go.mod, Cargo.toml), then use AskUserQuestion with explicit commands in option descriptions:
- **Manual**: State the detected command for user to run
- **Autonomous**: State the exact command that will be executed

### 4. Retrieve & Analyze
```bash
<command> 2>&1 | grep DEBUG_K9P2M
```
Identify unexpected paths, incorrect state, missing/duplicate calls, timing issues.

### 5. Clean Up
```bash
grep -r "DEBUG_K9P2M" . --files-with-matches
```
Edit files to remove all logs.

# Example

**Problem:** `calculate_total()` returns wrong value intermittently

```python
def calculate_total(items):
    print(f"DEBUG_K9P2M | entry: items={items}", file=sys.stderr)
    total = 0
    for item in items:
        print(f"DEBUG_K9P2M | loop: item={item}, total={total}", file=sys.stderr)
        total += item.price * item.quantity
    print(f"DEBUG_K9P2M | exit: total={total}", file=sys.stderr)
    return total
```

Detect pytest.ini → Ask user with "Autonomous will run: `pytest tests/test_checkout.py -v 2>&1 | grep DEBUG_K9P2M`" → Run → Analyze: `item.quantity` is `None` → Clean up

# Notes

- **AskUserQuestion format**: Include detected command in option descriptions
  - Manual: "You run the program and provide output. Command: `pytest tests/ -v 2>&1 | grep DEBUG_XYZ`"
  - Autonomous: "Claude runs and analyzes automatically. Will execute: `pytest tests/test_file.py -v 2>&1 | grep DEBUG_XYZ`"
- For async/concurrent: include thread/task IDs
- Complex objects: JSON serialize
- Project detection: package.json → npm test, pytest.ini → pytest, go.mod → go test, Cargo.toml → cargo test
