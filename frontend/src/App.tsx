import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/seasons" element={<LeaderboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/register" element={<HomePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
