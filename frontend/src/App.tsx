import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/seasons" element={<HomePage />} />
          <Route path="/leaderboard" element={<HomePage />} />
          <Route path="/register" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
