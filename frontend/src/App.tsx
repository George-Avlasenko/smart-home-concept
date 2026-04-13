import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { AllDevices } from './pages/AllDevices';
import { Groups } from './pages/Groups';
import { Profile } from './pages/Profile';
import { HouseManagement } from './pages/HouseManagement';
import { UserManagement } from './pages/UserManagement';
import { Integrations } from './pages/Integrations';
import { TuyaLightExperiment } from './pages/TuyaLightExperiment';
import { PowerOff } from './pages/PowerOff';
import { Layout } from './components/Layout';
import { SelectedHouseProvider } from './context/SelectedHouseContext';
import { CssBaseline } from '@mui/material';
import { theme } from './theme';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <SelectedHouseProvider>
          <CssBaseline />
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/power-off" element={<PowerOff />} />
              
              {/* Защищенные маршруты внутри Layout */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/devices" element={<AllDevices />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/labs/tuya" element={<TuyaLightExperiment />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin/houses" element={<HouseManagement />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/integrations" element={<Integrations />} />
            </Route>
            </Routes>
          </Router>
        </SelectedHouseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
