# Memory Bank

This directory contains local memory files that are automatically loaded by Hackable Claude. These provide persistent context that's available across all conversations.

## How It Works

- **Local memories**: Files in this directory are read-only and shared across all users
- **User memories**: Created through the UI, stored in `~/.hackable-claude/memorybank/`
- **Automatic loading**: All memory files are loaded on app startup
- **Context integration**: Memories appear as violet blocks in the context window

## File Format

Each memory file should be a JSON file with this structure:

```json
{
  "id": "unique-identifier",
  "label": "Brief descriptive label",
  "content": "The actual memory content with detailed information...",
  "tokens": 150,
  "timestamp": 1710271200000,
  "category": "reference"
}
```

### Fields:
- `id`: Unique identifier (will be prefixed with `local:` internally)
- `label`: Short descriptive label shown in the UI
- `content`: The actual memory content (supports Markdown)
- `tokens`: Estimated token count (roughly content.length / 4)
- `timestamp`: Unix timestamp (used for sorting)
- `category`: One of: `conversation`, `insight`, `code`, `reference`, `other`

## Categories

- **conversation**: Important discussions and decision points
- **insight**: Key learnings and discoveries
- **code**: Programming patterns, best practices, architecture notes
- **reference**: Documentation, APIs, specifications
- **other**: General knowledge and miscellaneous information

## Usage

1. Add `.json` files to this directory
2. Restart the app (or wait for the next memory refresh)
3. Memories will appear as violet blocks in the context window
4. Local memories are read-only and cannot be edited through the UI

## Examples

See the existing files in this directory for examples of well-structured memory entries.