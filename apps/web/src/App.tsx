import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BuilderShell } from './components/builder/builder-shell';
import { SignupPage } from './pages/signup';
import { LoginPage } from './pages/login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/builder" element={<BuilderShell functionCode="statistical-programming" />} />
        <Route path="/" element={<Navigate to="/signup" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
