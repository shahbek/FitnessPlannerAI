# Fitness Planner AI

An AI-powered personal fitness trainer application built with React, TypeScript, and Vite. This application integrates with Groq's API to generate personalized workout and nutrition plans based on user preferences and constraints.

## Features

- **AI-Powered Planning**: Uses Groq's language models to generate personalized fitness plans
- **Comprehensive User Profiles**: Collects detailed user information including body metrics, goals, and preferences
- **Smart Safety Checks**: Built-in validation to ensure realistic and safe fitness goals
- **Flexible Scheduling**: Accommodates various workout schedules and time constraints
- **Nutrition Planning**: Generates meal plans with macro calculations
- **Export Functionality**: Export plans as PDF or JSON
- **Responsive Design**: Modern, mobile-friendly interface built with Tailwind CSS

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **PDF Export**: jsPDF with autoTable
- **API Integration**: Groq API (OpenAI-compatible)
- **Code Quality**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Groq API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fitness-planner-ai
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Configure API**: Enter your Groq API key and select your preferred model
2. **User Profile**: Fill in your personal information including age, height, weight, and fitness goals
3. **Schedule & Preferences**: Specify your available workout times and dietary preferences
4. **Generate Plan**: Click "Generate Plan" to create your personalized fitness plan
5. **Review & Export**: Review the generated plan and export as PDF or copy as JSON

## API Configuration

The application supports any OpenAI-compatible API endpoint. Default configuration:

- **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Model**: `llama-3.1-70b-versatile`

## Project Structure

```
src/
├── components/          # React components
│   ├── forms/          # Form components
│   ├── plan/           # Plan display components
│   └── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── constants/          # Application constants
└── App.tsx            # Main application component
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript type checking

### Code Quality

The project uses ESLint and Prettier for code quality and formatting. Run `npm run lint:fix` and `npm run format` before committing changes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
