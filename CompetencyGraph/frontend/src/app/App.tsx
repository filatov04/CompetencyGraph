import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./providers";
import styles from "./App.module.css";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <nav className={styles.tabs}>
          <Link 
            to="/" 
            className={`${styles.tab} ${location.pathname === "/" ? styles.active : ""}`}
          >
            Граф
          </Link>
          <Link 
            to="/markup" 
            className={`${styles.tab} ${location.pathname === "/markup" ? styles.active : ""}`}
          >
            Разметка
          </Link>
        </nav>
        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            {user?.first_name && user?.last_name ? (
              <>
                <div className={styles.userName}>
                  {user.first_name} {user.last_name}
                </div>
                <div className={styles.userEmail}>{user.email}</div>
              </>
            ) : (
              <div className={styles.userName}>
                {user?.email}
              </div>
            )}
          </div>
          <button 
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            Выйти
          </button>
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}

export default App;
