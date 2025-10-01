# GitHub Pages Setup Guide

To enable automatic deployment to GitHub Pages, you need to configure your repository settings:

## Repository Settings

1. Go to your repository on GitHub: `https://github.com/MadonnaMat/dreadrpg`
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. Save the settings

## What This Enables

Once configured, the GitHub Actions workflow will:

1. **On every push to main**:

   - Run the test suite
   - Build the application
   - Deploy to GitHub Pages if tests pass

2. **On pull requests**:
   - Run tests and linting
   - Provide feedback on the PR

## Accessing Your Deployed Site

After the first successful deployment, your site will be available at:
`https://MadonnaMat.github.io/dreadrpg/`

## Workflow Details

The workflow (`.github/workflows/test-and-deploy.yml`) includes:

- **Test Job**: Runs on all pushes and PRs

  - Checkout code
  - Setup Node.js 18
  - Install dependencies
  - Run ESLint
  - Run test suite
  - Build application
  - Upload build artifacts

- **Deploy Job**: Only runs on main branch pushes after tests pass
  - Download build artifacts
  - Configure GitHub Pages
  - Deploy to Pages

## Environment Variables

No environment variables are required for this setup. The workflow uses:

- `GITHUB_TOKEN` (automatically provided)
- GitHub Pages deployment actions

## Troubleshooting

### Common Issues

1. **Pages not enabled**: Make sure GitHub Pages is set to "GitHub Actions" in repository settings
2. **Build failures**: Check the Actions tab for detailed error logs
3. **Permission errors**: The workflow includes all necessary permissions

### Viewing Deployment Status

1. Go to the **Actions** tab in your repository
2. Click on the latest workflow run
3. View logs for detailed information about each step
