import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import Home from './pages/Home';

export default function App() {
  const { authUser } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* If logged in, show Home. Otherwise, force to Login */}
        <Route 
          path="/" 
          element={authUser ? <Home /> : <Navigate to="/login" />} 
        />
        
        {/* If NOT logged in, show SignUp. Otherwise, force to Home */}
        <Route 
          path="/signup" 
          element={!authUser ? <SignUp /> : <Navigate to="/" />} 
        />
        
        {/* If NOT logged in, show Login. Otherwise, force to Home */}
        <Route 
          path="/login" 
          element={!authUser ? <Login /> : <Navigate to="/" />} 
        />
      </Routes>
    </BrowserRouter>
  );
}