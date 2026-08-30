import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { BuilderShell } from './components/builder/builder-shell';
import { SignupPage } from './pages/signup';
import { LoginPage } from './pages/login';
import { FunctionSelectionPage } from './pages/function-selection';

function BuilderShellWrapper() {
  const { functionCode } = useParams<{ functionCode: string }>();
  if (!functionCode) return <Navigate to="/functions" replace />;
  return <BuilderShell functionCode={functionCode} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/functions" element={<FunctionSelectionPage />} />
        <Route path="/builder/:functionCode" element={<BuilderShellWrapper />} />
        <Route path="/" element={<Navigate to="/signup" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
