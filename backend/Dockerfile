# Use official Python image
FROM python:3.10

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN pip install --no-cache-dir flask psycopg2 redis

# Expose Flask port
EXPOSE 5000

# Run Flask
CMD ["python", "app.py"]
