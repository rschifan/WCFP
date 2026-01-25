# World Checklist of Food Plants (WCFP)

A SvelteKit application for exploring and visualizing the World Checklist of Food Plants (WCFP) - an interactive platform for browsing species taxonomy, geographic distribution, and food plant data.

## Features

- Interactive taxonomy tree visualization for food plants
- Species distribution mapping using WCFP data
- Geographic data exploration with TDWG regions
- Food plant use categories and characteristics
- Responsive design with modern UI

## Development Setup

### Prerequisites

- Node.js 20 or higher
- pnpm (recommended) or npm

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd explorer
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Obtain source data files** (required for preprocessing):

   The preprocessing scripts require the following WCFP source data files in the `data/` directory:
   - `data/1.geo_distr_taxa.csv` (55 MB) - Species geographic distribution data
   - `data/3.WCFP.xlsx` - World Checklist of Food Plants (WCFP) species data
   - `data/wgsrpd-master/` - TDWG geographic region data (optional)

   **Note**: These files are excluded from git due to their size. You need to obtain them separately:
   - From a team shared location
   - From cloud storage
   - From the original data source

   Once you have the data files, place them in the `data/` directory.

5. Generate static data files (if needed):

   ```bash
   pnpm preprocess:species
   node scripts/preprocess-taxonomy.js
   node scripts/preprocess-taxonomy-tree.js
   ```

6. Start the development server:

   ```bash
   pnpm dev
   ```

   The application will be available at `http://localhost:5173`

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally
- `pnpm lint` - Run linting checks
- `pnpm check` - Run TypeScript type checking
- `pnpm test` - Run tests
- `pnpm format` - Format code with Prettier
- `pnpm preprocess:species` - Generate WCFP species data files from source CSV/XLSX

## Building for Production

```bash
pnpm build
```

The production build will be output to the `build/` directory, ready for static hosting.

## Deployment

### Automated Deployment via GitHub Actions

The project includes automated CI/CD pipelines:

- **CI Pipeline**: Runs on every push and pull request
  - Tests code quality (lint, type check)
  - Runs test suite
  - Builds the project
  - [![CI](https://github.com/rschifan/WCFP/workflows/CI/badge.svg)](https://github.com/rschifan/WCFP/actions/workflows/ci.yml)

- **Deploy Pipeline**: Runs on push to `main` branch
  - Builds the project
  - Deploys via SFTP/SSH to the web server
  - [![Deploy](https://github.com/rschifan/WCFP/workflows/Deploy/badge.svg)](https://github.com/rschifan/WCFP/actions/workflows/deploy.yml)

### Setting Up Automated Deployment

1. **Prepare SSH Key**:
   - Generate an SSH key pair **without a passphrase** (required for CI/CD):
     ```bash
     ssh-keygen -t ed25519 -a 100 -C "github-actions-deploy" -f ~/.ssh/deploy_key -N ""
     ```

     - `-t ed25519`: Use Ed25519 algorithm (recommended, more secure)
     - `-a 100`: Number of KDF rounds (security hardening)
     - `-N ""`: Empty passphrase (required for automated workflows)
     - `-f ~/.ssh/deploy_key`: Output file path
   - Add the **public key** to your server's `~/.ssh/authorized_keys`:
     ```bash
     ssh-copy-id -i ~/.ssh/deploy_key.pub user@your-server.com
     ```
     Or manually:
     ```bash
     cat ~/.ssh/deploy_key.pub | ssh user@your-server.com "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
     ```
   - Copy the **private key** content to GitHub Secrets:
     ```bash
     cat ~/.ssh/deploy_key
     ```

     - Copy the **entire output**, including:
       - `-----BEGIN OPENSSH PRIVATE KEY-----` (or `-----BEGIN RSA PRIVATE KEY-----`)
       - All lines of the key
       - `-----END OPENSSH PRIVATE KEY-----` (or `-----END RSA PRIVATE KEY-----`)
     - **Important**: Make sure you're copying the PRIVATE key (not the `.pub` file)
     - Ensure no extra spaces or line breaks are added

2. **Configure GitHub Secrets**:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `SSH_PRIVATE_KEY` - Your full SSH private key (including `-----BEGIN` and `-----END` lines)
     - `SSH_HOST` - Your server hostname or IP address
     - `SSH_USERNAME` - SSH username
     - `SSH_PORT` - SSH port (default: 22, optional)
     - `SSH_REMOTE_PATH` - Remote directory path on server (e.g., `/var/www/html`)

3. **Deploy**:
   - Push to the `main` branch to trigger automatic deployment
   - Or use the "Run workflow" button in GitHub Actions for manual deployment

### Manual Deployment

For manual deployments, you can use SFTP/SCP to upload the `build/` directory:

```bash
# Build the project
pnpm build

# Deploy via SCP
scp -r build/* user@your-server.com:/var/www/html/
```

## Environment Variables

See `.env.example` for required environment variables. Copy it to `.env` and fill in your values:

- `SFTP_HOST` - SFTP server hostname
- `SFTP_USER` - SFTP username
- `SFTP_PORT` - SFTP port (default: 22)
- `SFTP_REMOTE_PATH` - Remote directory path

**Note**: Never commit `.env` files with real credentials. Use GitHub Secrets for CI/CD.

## Project Structure

```
explorer/
├── .github/
│   ├── workflows/          # CI/CD workflows
│   └── dependabot.yml     # Automated dependency updates
├── data/                   # Source data files (excluded from git)
├── scripts/                # Preprocessing scripts
├── src/                    # Application source code
│   ├── lib/               # Shared components and utilities
│   └── routes/            # SvelteKit routes
├── static/                 # Static assets and generated data
└── build/                  # Production build output (generated)
```

## Source Data Files

The WCFP application uses preprocessing scripts to transform large source data files into optimized JSON files. These WCFP source files are **not** included in the repository due to their size:

- Large CSV files (>50MB) - Geographic distribution data
- Excel files (XLSX) - WCFP species data with taxonomy and use information
- Geographic data files (MBTiles, GeoJSON) - TDWG region boundaries
- Shapefiles - Geographic region data

**To obtain WCFP source data files:**

1. Contact the WCFP project maintainer
2. Check team shared storage
3. Download from the original WCFP data source
4. Place files in the `data/` directory before running preprocessing scripts

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and tests (`pnpm lint && pnpm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Quality

- All code must pass linting (`pnpm lint`)
- TypeScript types must be correct (`pnpm check`)
- Tests must pass (`pnpm test`)
- Code should be formatted with Prettier (`pnpm format`)

## Technology Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: MapLibre GL, Deck.gl
- **Visualization**: D3.js
- **Package Manager**: pnpm

## License

[Add your license here]

## Support

For issues and questions, please open an issue on GitHub.
