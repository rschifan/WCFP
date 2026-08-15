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
   - `data/WCFP.xlsx` - the WCFP taxon table deposited with the paper (26,622 taxa)
   - `data/geo_distr_taxa_ISO_R1.csv` (45 MB) - distribution records with `occurrence_status`
   - `data/TDWG3_count_wcfp_ISO_R1.csv` - the published per-area counts, ISO codes and
     `flora_richness` / `pct_of_flora`
   - `data/wgsrpd-master/` - TDWG Level-3 shapefile (geometry only)

   **Note**: These files are excluded from git due to their size. You need to obtain them separately:
   - From a team shared location
   - From cloud storage
   - From the original data source

   Once you have the data files, place them in the `data/` directory.

5. Build the DuckDB database used by the app runtime:

   ```bash
   pnpm refresh:data
   ```

   This rebuilds `data/wcfp.duckdb` from the `WCFP` sheet in `data/WCFP.xlsx` together with the
   distribution and per-area count CSVs and the TDWG shapefile.

   The build **fails** unless every one of the 367 areas' computed taxon counts equals the figure
   published in the paper. Regions are keyed by TDWG Level-3 code throughout; area names are
   display labels taken from the published dataset, never join keys.

6. Verify the result against the published dataset:

   ```bash
   pnpm verify:data
   ```

   This re-reads the source files independently of the database and asserts the figures the
   portal displays — taxon, genus and family totals, per-area counts, occurrence-status tallies,
   and the use flags. A renamed workbook column degrades silently to `false`/`Unknown` rather
   than erroring, so this check is what catches it.

7. Start the development server:

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
- `pnpm refresh:data` - Rebuild the DuckDB database used at runtime
- `pnpm build:db` - Rebuild `data/wcfp.duckdb`
- `pnpm verify:data` - Check the built database against the published dataset

## Building for Production

```bash
pnpm build
```

The production build will be output to the `build/` directory as an adapter-node server bundle.

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
  - Deploys the Node server bundle to the web server
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

For manual deployments, build the server bundle and run it on the target host:

```bash
# Build the project
pnpm build

# Start the adapter-node server
node build
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

**Verifying what you received.** `data/MANIFEST.sha256` records the SHA-256 of every
source input the build consumes, plus the generated database. The files themselves are
not in this repository — only their checksums — so provenance is public even though the
data is distributed on request. From the repository root:

```bash
sha256sum -c data/MANIFEST.sha256
```

All five entries must report `OK`. A mismatch means your copy differs from the one the
deployed database was built from, and `pnpm refresh:data` would produce a different
result.

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
