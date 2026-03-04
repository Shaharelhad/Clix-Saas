import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import ProfilePage from "./pages/ProfilePage";
import CreateBotPage from "./pages/CreateBotPage/CreateBotPage";
import AuthPage from "./pages/AuthPage";
import PendingPage from "./pages/PendingPage";

function App() {
  return (
    <Routes>
      {/* Sample only */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/pending" element={<PendingPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/create-bot" element={<CreateBotPage />} />
    </Routes>
  );
}

export default App;
