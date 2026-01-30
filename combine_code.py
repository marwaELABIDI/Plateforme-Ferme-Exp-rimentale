import os

# Directories to exclude
EXCLUDE_DIRS = {
    'node_modules', 'venv', 'env', '__pycache__', '.git', '.next', 'dist', 'build', 'packages', '.turbo', '.cache'
}
# File extensions to EXCLUDE
EXCLUDE_EXTS = {
    '.json', '.pdf', '.txt'
}

def should_include_file(filename):
    return not any(filename.endswith(ext) for ext in EXCLUDE_EXTS)

def main(root_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as out:
        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Remove excluded directories in-place
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for filename in filenames:
                if should_include_file(filename):
                    rel_path = os.path.relpath(os.path.join(dirpath, filename), root_dir)
                    out.write(f"\n\n# ==== {rel_path} ====\n\n")
                    with open(os.path.join(dirpath, filename), 'r', encoding='utf-8', errors='ignore') as f:
                        out.write(f.read())

if __name__ == "__main__":
    # Change '.' to your project root if needed
    main('.', 'all_code_combined.txt')