import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './pages/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Plots from './pages/Plots';
import Trees from './pages/Trees';
import Users from './pages/Users';
import CommunityEnterprises from './pages/CommunityEnterprises';
import Purposes from './pages/Purposes';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedRoute>} />
          <Route path="/plots" element={<ProtectedRoute><AdminLayout><Plots /></AdminLayout></ProtectedRoute>} />
          <Route path="/trees" element={<ProtectedRoute><AdminLayout><Trees /></AdminLayout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requireAdmin><AdminLayout><Users /></AdminLayout></ProtectedRoute>} />
          <Route path="/community-enterprises" element={<ProtectedRoute><AdminLayout><CommunityEnterprises /></AdminLayout></ProtectedRoute>} />
          <Route path="/purposes" element={<ProtectedRoute requireAdmin><AdminLayout><Purposes /></AdminLayout></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
