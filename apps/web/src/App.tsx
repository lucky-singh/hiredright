import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { BuilderShell } from './components/builder/builder-shell';
import { SignupPage } from './pages/signup';
import { LoginPage } from './pages/login';
import { FunctionSelectionPage } from './pages/function-selection';
import { SearchPage } from './pages/search';
import { CandidateProfilePage } from './pages/candidate-profile';

function BuilderShellWrapper() {
  const { roleCode } = useParams<{ roleCode: string }>();
  if (!roleCode) return <Navigate to="/functions" replace />;
  return <BuilderShell roleCode={roleCode} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/functions" element={<FunctionSelectionPage />} />
        <Route path="/builder/:roleCode" element={<BuilderShellWrapper />} />
        <Route path="/profile" element={<CandidateProfilePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/" element={<Navigate to="/signup" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
