# Project Graph - RDF Graph Visualization

Приложение для визуализации и работы с RDF-графами с возможностью разметки и авторизацией пользователей.

## Установка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка подключения к Backend

Backend API должен быть запущен на `http://localhost:80`. 

Если вам нужно изменить URL backend API, создайте файл `.env` в корне проекта:

```bash
VITE_API_URL=http://localhost:80/api/v1
```

### 3. Запуск приложения

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:5173` (или другому порту, указанному Vite).

## Функциональность

### Авторизация

- **Регистрация**: `/register` - создание нового аккаунта
- **Вход**: `/login` - вход в систему
- **Автоматическое обновление токенов**: Access token автоматически обновляется при истечении срока действия

### Основные возможности

- **Граф**: Визуализация и редактирование RDF-графов
- **Разметка**: Работа с разметкой данных

## Backend API

Приложение работает с следующими endpoint'ами:

- `POST /api/v1/auth/register` - регистрация пользователя
- `POST /api/v1/auth/login` - вход в систему
- `POST /api/v1/auth/refresh` - обновление access token
- `POST /api/v1/auth/logout` - выход из системы

Все защищенные endpoints требуют заголовок:
```
Authorization: Bearer {access_token}
```

## Технологии

- React 18
- TypeScript
- Vite
- React Router
- Axios
- Feature-Sliced Design архитектура

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
