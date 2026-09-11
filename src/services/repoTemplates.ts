

export const backendPackageJson = JSON.stringify(
  {
    name: "generated-backend",
    version: "1.0.0",
    private: true,
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "ts-node src/index.ts",
      test: "jest",
    },
    dependencies: {
      express: "^4.19.2",
      mongoose: "^8.5.0",
      jsonwebtoken: "^9.0.2",
      bcrypt: "^5.1.1",
      cors: "^2.8.5",
      dotenv: "^16.4.5",
    },
    devDependencies: {
      typescript: "^5.5.4",
      "ts-node": "^10.9.2",
      jest: "^29.7.0",
      "ts-jest": "^29.2.4",
      "@types/jest": "^29.5.12",
      "@types/express": "^4.17.21",
      "@types/node": "^20.14.0",
      supertest: "^7.0.0",
      "@types/supertest": "^6.0.2",
    },
  },
  null,
  2
);

export const frontendPackageJson = JSON.stringify(
  {
    name: "generated-frontend",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "vite",
      build: "vite build",
      test: "jest",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "react-router-dom": "^6.26.0",
      axios: "^1.7.4",
    },
    devDependencies: {
      typescript: "^5.5.4",
      vite: "^5.4.0",
      "@vitejs/plugin-react": "^4.3.1",
      tailwindcss: "^3.4.9",
      jest: "^29.7.0",
      "jest-environment-jsdom": "^29.7.0",
      "@testing-library/react": "^16.0.0",
      "@testing-library/jest-dom": "^6.4.8",
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
    },
  },
  null,
  2
);