"""
Text chunking utility.
Splits text into chunks with line-aware boundaries.
Used ONLY for PDF/DOCX/TXT documents.
Excel/CSV now uses structured JSONB storage (no chunking needed).
"""
import tiktoken


def chunk_text(
    text: str,
    chunk_size: int = 800,
    chunk_overlap: int = 100,
    model: str = "cl100k_base",
) -> list[str]:
    """
    Split text into chunks based on token count, respecting line boundaries.

    Args:
        text: The text to split
        chunk_size: Target tokens per chunk
        chunk_overlap: Number of overlapping lines to include
        model: Tiktoken encoding model

    Returns:
        List of text chunks
    """
    if not text.strip():
        return []

    encoder = tiktoken.get_encoding(model)

    # Check if total text fits in one chunk
    total_tokens = len(encoder.encode(text))
    if total_tokens <= chunk_size:
        return [text]

    # Split into lines and chunk by line boundaries
    lines = text.split("\n")

    chunks = []
    current_lines = []
    current_tokens = 0

    for line in lines:
        line_tokens = len(encoder.encode(line))

        # If adding this line would exceed chunk_size, save current chunk
        if current_tokens + line_tokens > chunk_size and current_lines:
            chunk = "\n".join(current_lines).strip()
            if chunk:
                chunks.append(chunk)

            # Keep last few lines as overlap for context continuity
            overlap_lines = []
            overlap_tokens = 0
            for prev_line in reversed(current_lines):
                prev_tokens = len(encoder.encode(prev_line))
                if overlap_tokens + prev_tokens > chunk_overlap:
                    break
                overlap_lines.insert(0, prev_line)
                overlap_tokens += prev_tokens

            current_lines = overlap_lines
            current_tokens = overlap_tokens

        current_lines.append(line)
        current_tokens += line_tokens

    # Don't forget the last chunk
    if current_lines:
        chunk = "\n".join(current_lines).strip()
        if chunk:
            chunks.append(chunk)

    return chunks


def count_tokens(text: str, model: str = "cl100k_base") -> int:
    """Count the number of tokens in a text string."""
    encoder = tiktoken.get_encoding(model)
    return len(encoder.encode(text))
