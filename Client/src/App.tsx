import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage/HomePage";
import ProfilePage from "./pages/ProfilePage";
import CreateBotPage from "./pages/CreateBotPage/CreateBotPage";

function App() {
  return (
    <Routes>
      {/* Sample only */}
      <Route path="/" element={<HomePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/create-bot" element={<CreateBotPage />} />
    </Routes>
  );
}

export default App;
