# Linear CLI

A command-line interface for Linear project management, powered by the Linear MCP server via mcp2py.

## Features

- **Issue Management**: List, view, create, and update Linear issues
- **Comment Management**: View and add comments to issues
- **OAuth Authentication**: Secure authentication via browser-based OAuth 2.1 flow
- **Interactive Prompts**: User-friendly prompts for creating issues and comments
- **Filtering**: Filter issues by assignee, status, label, and team

## Installation

### Prerequisites

- Python >= 3.11
- `uv` package manager (for automatic dependency management)

### Setup

1. Make the script executable (if not already):
   ```bash
   chmod +x linear
   ```

2. Add to your PATH or create an alias:
   ```bash
   # Option 1: Copy to a directory in your PATH
   cp linear ~/.local/bin/linear

   # Option 2: Create an alias in ~/.zshrc or ~/.bashrc
   alias linear='/path/to/kit/linear'
   ```

3. Start using the CLI:
   ```bash
   linear issue list
   # Browser opens for OAuth on first run
   # Authenticate with your Linear account
   # Future commands work automatically!
   ```

## Usage

### Issue Commands

#### List Issues

```bash
# List all issues (default: 20 most recent)
linear issue list

# Filter by status
linear issue list --status "In Progress"

# Filter by assignee
linear issue list --assignee "user-id-123"

# Filter by team
linear issue list --team "team-id-456"

# Filter by label
linear issue list --label "bug"

# Combine filters and set limit
linear issue list --status "Todo" --team "team-id-456" --limit 50
```

#### View Issue Details

```bash
# View full details of a specific issue
linear issue view LIN-123
```

#### Create Issue

```bash
# Interactive mode (prompts for all fields)
linear issue create

# With command-line options
linear issue create --title "Fix login bug" --description "Users can't log in" --team "team-id-123"

# Partial options (prompts for missing fields)
linear issue create --title "New feature request"
```

#### Update Issue

```bash
# Update issue status
linear issue update LIN-123 --status "In Progress"

# Update assignee
linear issue update LIN-123 --assignee "user-id-456"

# Update title
linear issue update LIN-123 --title "Updated title"

# Update multiple fields
linear issue update LIN-123 --status "Done" --assignee "user-id-789" --title "Completed feature"
```

### Comment Commands

#### List Comments

```bash
# List all comments for an issue
linear comment list LIN-123
```

#### Create Comment

```bash
# Interactive mode
linear comment create LIN-123

# With message flag
linear comment create LIN-123 -m "Working on this now"
linear comment create LIN-123 --message "This is blocked by LIN-456"
```

## Authentication

The Linear CLI uses **OAuth 2.1** via the Linear remote MCP server:

1. **First run** - Browser opens automatically:
   ```bash
   linear issue list
   ```

2. **Authorize** - Log in with your Linear account in the browser

3. **Done** - Tokens are cached automatically, future commands work seamlessly

### How it Works

The CLI uses `mcp-remote` to bridge the Linear remote MCP server (`https://mcp.linear.app/sse`) to stdio, which allows mcp2py to communicate with it. OAuth is handled automatically by the remote server.

### Custom MCP Server Command

By default, the CLI uses `pnpx mcp-remote https://mcp.linear.app/sse`. You can override this:

```bash
export LINEAR_MCP_COMMAND="pnpx mcp-remote https://your-custom-mcp-server.com/sse"
linear issue list
```

## Configuration

### Environment Variables

- `LINEAR_MCP_COMMAND`: Custom Linear MCP server command (default: `pnpx mcp-remote https://mcp.linear.app/sse`)

No API keys needed - OAuth tokens are managed automatically!

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────┐
│ linear CLI (Python + Click)                │
│   - Command parsing                         │
│   - Interactive prompts (questionary)       │
│   - Output formatting                       │
└─────────────────┬───────────────────────────┘
                  │
                  │ mcp2py.load()
                  ▼
┌─────────────────────────────────────────────┐
│ mcp2py Client Library                       │
│   - Subprocess management                   │
│   - stdio transport                         │
│   - MCP protocol handling                   │
└─────────────────┬───────────────────────────┘
                  │
                  │ stdio (JSON-RPC)
                  ▼
┌─────────────────────────────────────────────┐
│ Linear MCP Server (npx subprocess)          │
│   - list_issues, get_issue, create_issue    │
│   - update_issue, list_comments, etc.       │
└─────────────────┬───────────────────────────┘
                  │
                  │ Linear API (uses LINEAR_API_KEY)
                  ▼
┌─────────────────────────────────────────────┐
│ Linear Platform                             │
└─────────────────────────────────────────────┘
```

### Dependencies

Managed automatically by uv's inline script metadata:

- `mcp2py>=0.4.0`: Python client for Model Context Protocol
- `click`: CLI framework for command parsing
- `questionary`: Interactive prompts

### MCP Tools Used

The CLI leverages these Linear MCP tools:

- `list_issues`: List issues with filtering
- `get_issue`: Retrieve detailed issue information
- `create_issue`: Create new issues
- `update_issue`: Update existing issues
- `list_comments`: List comments for an issue
- `create_comment`: Add comments to issues

## Error Handling

The CLI provides clear error messages for common scenarios:

- **Connection errors**: Network issues or MCP server unavailable
- **Authentication errors**: OAuth failures or token issues
- **Invalid issue IDs**: Issue not found or access denied
- **Validation errors**: Missing required fields

## Examples

### Typical Workflow

```bash
# List your current tasks
linear issue list --assignee "my-user-id" --status "In Progress"

# View details of a specific issue
linear issue view LIN-123

# Add a comment with progress update
linear comment create LIN-123 -m "Fixed the authentication bug, testing now"

# Update issue status
linear issue update LIN-123 --status "In Review"

# Create a new bug report
linear issue create \
  --title "Login fails on mobile" \
  --description "Users on iOS can't log in after update" \
  --team "mobile-team-id" \
  --status "Todo"
```

### Finding IDs

User IDs, Team IDs, and other identifiers can be found in Linear's web interface or via the Linear API. Future versions of this CLI may include commands to list teams and users.

## Troubleshooting

### OAuth Browser Doesn't Open

If the browser doesn't open automatically:

1. The authorization URL will be printed in the terminal
2. Copy and paste it into your browser manually
3. Complete authentication
4. The CLI will continue automatically

### Connection Errors

```bash
# Check internet connectivity
ping mcp.linear.app

# Verify pnpm/pnpx is installed
pnpx --version
```

### OAuth Token Issues

If you need to re-authenticate:

1. OAuth tokens are managed by mcp-remote
2. Simply run any command again - it will prompt for re-auth if needed
3. Check mcp-remote documentation for token cache location

## Future Enhancements

Potential features for future versions:

- `linear team list`: List available teams
- `linear user list`: List users in workspace
- `linear project list`: List projects
- `linear status list`: List available statuses
- `linear label list`: List available labels
- Shell completion (bash/zsh)
- Output formats (JSON, table, compact)
- Configuration file for defaults

## Contributing

This Linear CLI is part of the `kit` repository. See the main README for contribution guidelines.

## License

Same as the parent `kit` repository.
