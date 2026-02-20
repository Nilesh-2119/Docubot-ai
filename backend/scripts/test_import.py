import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    print("Importing app.models...")
    # import app.models
    from app.models import User, Chatbot, Document, Embedding, GoogleSheet, ExcelRow, GoogleIntegration
    print("Success")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
