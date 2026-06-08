import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Auth from './components/Auth';
import MainLayout from "./layouts/MainLayout.jsx";
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import UserProfile from './components/UserProfile';
import './styles/global.css';
import Rooms from "./components/Rooms.jsx";
import RoomDetail from "./components/RoomDetail";
import Groups from "./components/Group.jsx";
import ProtectedRoute from './components/ProtectedRoute';
import { DeviceProvider } from './context/DeviceContext';


function App() {
  return (
      <AuthProvider>
        <DeviceProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Auth />} />

              <Route element = {<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/rooms" element={<Rooms />} />
                    <Route path="/rooms/:roomId" element={<RoomDetail />} />
                    <Route path="/groups" element={<Groups />} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>


            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
        </DeviceProvider>
      </AuthProvider>
  );
}

export default App;