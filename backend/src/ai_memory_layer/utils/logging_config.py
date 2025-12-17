"""
Logging configuration for Memory Mesh.

This module provides structured logging configuration with JSON formatting
for production environments and human-readable formatting for development.
"""

import logging
import sys
from typing import Any
import json
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    
    Outputs log records as JSON objects for easy parsing by log aggregation systems.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record as JSON."""
        log_data: dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, "tenant_id"):
            log_data["tenant_id"] = record.tenant_id
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "duration"):
            log_data["duration"] = record.duration
        
        return json.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """
    Colored formatter for development environments.
    
    Adds colors to log levels for better readability in terminal output.
    """
    
    # ANSI color codes
    COLORS = {
        "DEBUG": "\033[36m",      # Cyan
        "INFO": "\033[32m",       # Green
        "WARNING": "\033[33m",    # Yellow
        "ERROR": "\033[31m",      # Red
        "CRITICAL": "\033[35m",   # Magenta
    }
    RESET = "\033[0m"
    
    def format(self, record: logging.LogRecord) -> str:
        """Format the log record with colors."""
        # Add color to level name
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
        
        # Format the message
        formatted = super().format(record)
        
        # Reset levelname for future use
        record.levelname = levelname
        
        return formatted


def setup_logging(
    level: str = "INFO",
    json_format: bool = False,
    log_file: str | None = None,
) -> None:
    """
    Configure logging for the application.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON formatting (for production)
        log_file: Optional file path to write logs to
    """
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    # Set formatter based on environment
    if json_format:
        formatter = JSONFormatter()
    else:
        formatter = ColoredFormatter(
            fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Add file handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_handler.setFormatter(JSONFormatter())  # Always use JSON for files
        root_logger.addHandler(file_handler)
    
    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)
