---
allowed-tools: Bash(~/Programming/brian-scripts/websearch:*)
description: Technical web search - use DETAILED questions with tech stack context (e.g., "How to implement OAuth2 in Node.js?" not "OAuth2"). Best for architecture, implementation, debugging, comparisons, best practices
argument-hint: [--model gpt|gemini] [--system "custom prompt"] "query"
---

Query arguments: $ARGUMENTS

Use the Bash tool to call: `~/Programming/brian-scripts/websearch` with the query arguments shown above.

The websearch CLI supports the following options:
- `-m, --model`: Choose 'gpt' (gpt-5-mini) or 'gemini' (gemini-2.5-flash)
- `-s, --system`: Override default optimized prompt with custom system message

The CLI is optimized for technical queries about:
- Architecture/Design patterns
- Implementation details with code examples
- Debugging strategies
- Performance optimization
- Technology comparisons
- Version-specific features and migrations

Pass all arguments as provided (including flags like --model or --system if specified) to the websearch command.

Then present the search results in a clear, well-formatted way with appropriate headers and formatting for technical information, code examples, pros/cons, security considerations, and best practices.
