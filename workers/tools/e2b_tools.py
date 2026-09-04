"""Factory function that creates Daytona SDK tool wrappers for a sandbox instance."""

import base64
from daytona import Sandbox


def create_tools(sandbox: Sandbox, emit_log):
    """Return a list of tool functions bound to the given sandbox."""

    def screenshot() -> str:
        """Take a screenshot of the current desktop and return it as a base64-encoded PNG string."""
        emit_log("screenshot", "Capturing current desktop state")
        resp = sandbox.computer_use.screenshot.take_full_screen()
        return resp.base64

    def click(x: int, y: int) -> str:
        """Left-click at the given (x, y) pixel coordinates on the desktop."""
        emit_log("click", f"Clicking at ({x}, {y})")
        sandbox.computer_use.mouse.click(x, y, "left")
        return f"Clicked at ({x}, {y})"

    def double_click(x: int, y: int) -> str:
        """Double-click at the given (x, y) pixel coordinates on the desktop."""
        emit_log("double_click", f"Double-clicking at ({x}, {y})")
        sandbox.computer_use.mouse.click(x, y, "left", True)
        return f"Double-clicked at ({x}, {y})"

    def type_text(text: str) -> str:
        """Type the given text string using the keyboard."""
        emit_log("type_text", f"Typing: {text[:80]}{'...' if len(text) > 80 else ''}")
        sandbox.computer_use.keyboard.type(text)
        return f"Typed: {text}"

    def press_key(key: str) -> str:
        """Press a keyboard key or key combination (e.g. 'Enter', 'ctrl+c', 'Tab')."""
        emit_log("press_key", f"Pressing key: {key}")
        if "+" in key:
            sandbox.computer_use.keyboard.hotkey(key)
        else:
            sandbox.computer_use.keyboard.press(key)
        return f"Pressed: {key}"

    def scroll(x: int, y: int, direction: str, amount: int) -> str:
        """Scroll at the given (x, y) coordinates. direction is 'up' or 'down'."""
        emit_log("scroll", f"Scrolling {direction} by {amount} at ({x}, {y})")
        sandbox.computer_use.mouse.move(x, y)
        sandbox.computer_use.mouse.scroll(x, y, direction, amount)
        return f"Scrolled {direction} by {amount} at ({x}, {y})"

    return [screenshot, click, double_click, type_text, press_key, scroll]