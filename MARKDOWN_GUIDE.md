# Markdown Guide

This project supports Markdown in **Issue Descriptions** and **Comments**. You can use Markdown to format your text, add lists, links, and even code blocks.

## Basic Syntax

### Headers
Use `#` for headings:
```markdown
# Heading 1
## Heading 2
### Heading 3
```

### Emphasis
```markdown
*italic* or _italic_
**bold** or __bold__
***bold and italic***
~~strikethrough~~
```

### Lists
**Unordered:**
```markdown
- Item 1
- Item 2
  - Sub-item 2a
```

**Ordered:**
```markdown
1. First item
2. Second item
```

**Task Lists:**
```markdown
- [x] Completed task
- [ ] Incomplete task
```

### Links and Images
```markdown
[Link Text](https://example.com)
![Alt Text](image-url)
```

### Code
**Inline code:** `` `code` ``

**Code blocks:**
```markdown
\```javascript
function hello() {
  console.log("Hello, World!");
}
\```
```

### Blockquotes
```markdown
> This is a blockquote.
```

### Tables
```markdown
| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
```

## Features
- **Preview Tab**: Both the Issue Form and the Comment box have a **Preview** tab where you can see how your Markdown will look before you save it.
- **Mentions**: You can still use `@username` to mention team members; they will work alongside your Markdown formatting.
