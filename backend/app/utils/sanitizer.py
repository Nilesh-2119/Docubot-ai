"""
Input sanitization utilities.
Prevents prompt injection and sanitizes user input.
"""
import re
import html


def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent injection attacks."""
    # HTML escape
    text = html.escape(text)

    # Remove null bytes
    text = text.replace("\x00", "")

    # Limit consecutive whitespace
    text = re.sub(r"\s{10,}", " " * 5, text)

    # Trim to reasonable length
    text = text[:10000]

    return text.strip()


def sanitize_filename(filename: str) -> str:
    """Sanitize uploaded file names."""
    # Remove path separators
    filename = filename.replace("/", "_").replace("\\", "_")

    # Remove potentially dangerous characters
    filename = re.sub(r'[<>:"|?*]', "_", filename)

    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "")
        filename = name[:250] + ("." + ext if ext else "")

    return filename


def check_prompt_injection(text: str) -> bool:
    """
    Basic check for common prompt injection patterns.
    Returns True if suspicious patterns are detected.
    """
    injection_patterns = [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"forget\s+(all\s+)?previous",
        r"you\s+are\s+now\s+",
        r"new\s+instructions?\s*:",
        r"system\s*:\s*",
        r"<\s*system\s*>",
        r"\[INST\]",
        r"<<SYS>>",
    ]

    text_lower = text.lower()
    for pattern in injection_patterns:
        if re.search(pattern, text_lower):
            return True

    return False
