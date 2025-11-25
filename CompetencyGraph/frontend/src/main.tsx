import "./shared/styles/variable.css";
import App from "./app/App.tsx";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./shared/store";
import GraphPage from "./pages/GraphPage/GraphPage.tsx";
import { MarkupEditor } from "./pages/MarkupPage/MarkupEditor.tsx";
import { LoginPage } from "./pages/LoginPage/index.ts";
import { RegisterPage } from "./pages/RegisterPage/index.ts";
import { AuthProvider, ProtectedRoute } from "./app/providers/index.ts";

const root = document.getElementById("root")!;

createRoot(root).render(
  <Provider store={store}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          >
            <Route index element={<GraphPage />} />
            <Route path="markup" element={<MarkupEditor />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </Provider>
);
