# CodeRabbit Modular Configuration

This directory contains a modular approach to managing your CodeRabbit configuration. Instead of maintaining one large `.coderabbit.yaml` file, the configuration is split into logical, manageable pieces.
You can access the documentation for all the settings [here](https://docs.coderabbit.ai/reference/configuration/).

## 📁 File Structure

```
.coderabbit/
├── README.md                 # This file
├── build.sh                  # Build script to combine files
└── config/                   # Configuration files
    ├── base.yml              # Basic configuration (language, tone)
    ├── review-settings.yml   # Review behavior and settings
    ├── tools.yml             # All linting and analysis tools
    └── chat-knowledge.yml    # Chat features and knowledge base
```

## 🚀 Making Changes

1. **Edit the relevant modular file** in the `config/` directory (e.g., `config/tools.yml` for tool settings)
2. **Run the build script** to regenerate `.coderabbit.yaml`
```shell
./build.sh
```
3. **Commit both** the modular files and the generated `.coderabbit.yaml`

## 🔍 Troubleshooting

**Build fails:**
- Check that all referenced files exist
- Ensure YAML syntax is valid in each file
- Run `yamllint .coderabbit/config/*.yml` to validate syntax

**Missing tools in output:**
- Verify the tool is in `config/tools.yml`
- Check proper indentation (tools need to be under `reviews.tools:`)
- Ensure the tool is in the correct section with proper formatting

**Generated file issues:**
- Never edit `.coderabbit.yaml` directly
- Always edit the modular files and rebuild
- The generated file will be overwritten on each build
