import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAvatar, CDropdown, CDropdownHeader, CDropdownItem, CDropdownMenu, CDropdownToggle, CSpinner } from '@coreui/react'
import { cilArrowThickFromRight } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { auth, db } from "../../api/configuration";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import translations from "../../language/translations"
import { LanguageContext } from "../../context/LanguageContext"
import defaultAvatar from "../../assets/images/avatars/9.jpg"

const AppHeaderDropdown = () => {
  const [loading, setLoading] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState('Currently redirecting to login page');
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatar);
  const [userName, setUsername] = useState('');
  const [Email, setEmail] = useState('');
  const navigate = useNavigate();
  const { language } = useContext(LanguageContext);

  // Ambil gambar avatar dan nama pengguna dari Firebase Authentication atau Firestore
  useEffect(() => {
    // Amati perubahan status autentikasi
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUsername(currentUser.displayName || ""); // Untuk mendapatkan nama pengguna
        setEmail(currentUser.email || ""); // Untuk mendapatkan email

        let avatar = currentUser.photoURL; // Tetapkan URL foto dari Firebase Authentication

        if (!avatar) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().avatarUrl) {
            avatar = userDoc.data().avatarUrl;
          }
        }

        if (avatar) {
          setAvatarUrl(avatar); // Tetapkan URL avatar dari Firestore
          localStorage.setItem("avatarUrl", avatar); // Simpan avatar ke localStorage
        } else {
          localStorage.removeItem("avatarUrl"); // Hapus jika avatar tidak ditemukan
        }
      } else {
        console.error("User is not authenticated.");
        setAvatarUrl(defaultAvatar);
        localStorage.removeItem("avatarUrl"); // Hapus avatar dari localStorage saat logout
      }
    });

    return () => unsubscribe();
  }, []); // Efek ini berjalan sekali saat komponen dipasang

  const messages = useMemo(() => [
    "Currently redirecting to login page",
    "Currently redirecting to login page.",
    "Currently redirecting to login page..",
    "Currently redirecting to login page..."
  ], []);

  // Untuk logout dan simpan toast ketika pengguna melakukan logout
  const handleLogout = useCallback(async () => {
    // Hapus tanda goodbyeToastShown saat keluar
    localStorage.removeItem("goodbyeToastShown");
    localStorage.removeItem("userLoggedIn");

    try {
      setLoading(true);

      let index = 0;
      const interval = setInterval(() => {
        setRedirectMessage(messages[index]);
        index = (index + 1) % messages.length;
      }, 500); // Ubah pesan setiap 500ms

      // Ambil user yang sedang login
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { systemstatus: "Offline" });
      }

      // Simulasikan waktu pemuatan dan keluar
      setTimeout(async () => {
        clearInterval(interval); // Berhenti mengubah pesan
        await auth.signOut();

        // Hapus semua data sesi yang berkaitan dengan login
        localStorage.removeItem("userSession");
        localStorage.removeItem("emailSignInUsed");
        sessionStorage.removeItem("loggedIn");
        sessionStorage.removeItem("loginWarningToastShown");

        // Diarahkan ke halaman login setelah keluar
        navigate("/login", { state: { showGoodbyeToast: true } });
      }, 3000); // Simulasikan penundaan 3 detik sebelum pengalihan
    } catch (error) {
      setLoading(false); // Hentikan pemuatan jika terjadi kesalahan
      console.error("Logout error:", error);
    }
  }, [messages, navigate]);

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
        <div className="username-avatar">
          {userName && <span className="username">{userName}</span>}
          <CAvatar src={avatarUrl} size="md" />
        </div>
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownHeader className="bg-body-secondary fw-semibold my-2">{translations[language].account}</CDropdownHeader>
        <div className='email-account'>({Email})</div>
        <CDropdownHeader className="bg-body-secondary fw-semibold my-2">{translations[language].settings}</CDropdownHeader>
        <CDropdownItem onClick={ handleLogout } className="link-logout">
          <CIcon icon={cilArrowThickFromRight} className="me-2" />{translations[language].logout}
        </CDropdownItem>
        <CDropdownHeader className="bg-body-secondary fw-semibold my-2">{translations[language].app_version}</CDropdownHeader>
        <div className='app-version'>2.1.1</div>
      </CDropdownMenu>

      {/* Loading and blur overlay */}
      {loading && (
        <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }} >
          <CSpinner color="primary" className="spinner" />
          <p className="redirect-message mt-3">{redirectMessage}</p>
        </div>
      )}
    </CDropdown>
  )
}

export default AppHeaderDropdown