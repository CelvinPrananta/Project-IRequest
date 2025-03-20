import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react'
import CIcon from '@coreui/icons-react'
import { useNavigate } from 'react-router-dom'
import { cilNotes, cilSpeedometer, cilArrowThickFromRight, cilUser, cilCloudUpload, cilList } from '@coreui/icons'
import { CNavGroup, CNavItem, CNavTitle, CSpinner } from '@coreui/react'
import { auth, db } from "./api/configuration";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import translations from './language/translations';
import { LanguageContext } from './context/LanguageContext';
import { API_BASE_URL } from "./api/base";

const LogoutButton = () => {
  const [loading, setLoading] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState("Currently redirecting to login page");
  const navigate = useNavigate();

  // Ambil language dari Context
  const { language } = useContext(LanguageContext);

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
      // Mulai memuat state
      setLoading(true);

      // Mengatur interval pesan untuk titik-titik
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
    <div>
      {/* Tombol keluar */}
      <button className="nav-link button-logout" onClick={handleLogout}>
        <CIcon icon={cilArrowThickFromRight} customClassName="nav-icon" />
        <span>{translations[language].logout}</span>
      </button>

      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }} >
          <CSpinner color="primary" className="spinner" />
          <p className="redirect-message mt-3">{redirectMessage}</p>
        </div>
      )}
    </div>
  );
};

const Navigation = () => {
  // Ambil language dari Context
  const { language } = useContext(LanguageContext);
  
  const [isAdmin, setIsAdmin] = useState(() => JSON.parse(localStorage.getItem("isAdmin")) || false);
  const [isDepartmentICT, setIsDepartmentICT] = useState(() => JSON.parse(localStorage.getItem("isDepartmentICT")) || false);
  const [isDepartmentComm, setIsDepartmentComm] = useState(() => JSON.parse(localStorage.getItem("isDepartmentComm")) || false);
  const [churchIds, setChurchIds] = useState(() => JSON.parse(localStorage.getItem("churchIds")) || []);
  const [churchList, setChurchList] = useState([]);

  // Ambil data gereja secara realtime
  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}`);
        if (!response.ok) {
          throw new Error("Failed to fetch churches");
        }
        const data = await response.json();
        setChurchList(data.result.rows); // Ambil data dari result.rows
      } catch (error) {
        console.error("Error fetching church list:", error);
      }
    };

    fetchChurches();
  }, []);

  // Untuk mengubah church_id menjadi nama gereja
  const getChurchName = (church_id) => {
    // Pastikan church_id selalu dalam bentuk array
    const ids = Array.isArray(church_id) ? church_id : [church_id];

    if (!ids || ids.length === 0) return '-';

    return ids
      .map((id) => {
        const church = churchList.find((c) => c.church_id === id);
        return church ? church.name.replace(/GMS/gi, "").trim() : '-';
      })
      .join(', ');
  };

  // Ambil data pengguna secara realtime
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);

    // Menggunakan onSnapshot untuk mendapatkan perubahan realtime
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setIsAdmin(userData.role === "Admin");
        setIsDepartmentICT(userData.department === "ICT");
        setIsDepartmentComm(userData.department === "Comm");
        
        // Cek jika church_id berubah sebelum mengupdate state
        const newChurchIds = userData.church_id || [];
        setChurchIds((prevChurchIds) => {
          if (JSON.stringify(prevChurchIds) !== JSON.stringify(newChurchIds)) {
            return newChurchIds;
          }
          return prevChurchIds;
        });

        // Simpan ke localStorage
        localStorage.setItem("isAdmin", JSON.stringify(userData.role === "Admin"));
        localStorage.setItem("isDepartmentICT", JSON.stringify(userData.department === "ICT"));
        localStorage.setItem("isDepartmentComm", JSON.stringify(userData.department === "Comm"));
        localStorage.setItem("churchIds", JSON.stringify(newChurchIds));
      }
    });

    return () => unsubscribe(); // Hentikan listener saat komponen di-unmount
  }, []);

  // Pastikan data churchIds dan churchList tidak kosong
  useEffect(() => {
  }, [churchIds, churchList]);

  // Filter dan mapping gereja
  const mappedChurches = churchIds
    .filter((id) =>
      churchList.find((c) => c.church_id === id))
    .map((id) => {
      const churchName = getChurchName(id);
      if (!churchName || churchName === "-") return null;

      const churchSlug = encodeURIComponent(churchName.toLowerCase().replace(/\s+/g, "-"));
    
      return {
        component: CNavItem,
        name: (
          <div style={{ display: "flex", alignItems: "center", whiteSpace: "normal", wordWrap: "break-word", maxWidth: "150px" }}>
            <CIcon icon={cilList} customClassName="nav-icon" />
            {/* <span>{translations[language].schedule} - {churchName}</span> */}
            <span>{churchName}</span>
          </div>
        ),
        to: `/event-schedule/list/${churchSlug}`,
        style: { margin: "0px 0px 0px 10px" }
      };
    })
    .filter(Boolean);

  const mappedFlyers = (isDepartmentICT || isDepartmentComm) && churchIds
    .filter((id) =>
      churchList.find((c) => c.church_id === id))
    .map((id) => {
      const churchName = getChurchName(id);
      if (!churchName || churchName === "-") return null;

      const churchSlug = encodeURIComponent(churchName.toLowerCase().replace(/\s+/g, "-"));
    
      return {
        component: CNavItem,
        name: (
          <div style={{ display: "flex", alignItems: "center", whiteSpace: "normal", wordWrap: "break-word", maxWidth: "150px" }}>
            <CIcon icon={cilList} customClassName="nav-icon" />
            {/* <span>{translations[language].flyer} - {churchName}</span> */}
            <span>{churchName}</span>
          </div>
        ),
        to: `/event-flyer/list/${churchSlug}`,
        style: { margin: "0px 0px 0px 10px" }
      };
    })
    .filter(Boolean);

  const mappedLooping = (isDepartmentICT || isDepartmentComm) && churchIds
    .filter((id) =>
      churchList.find((c) => c.church_id === id))
    .map((id) => {
      const churchName = getChurchName(id);
      if (!churchName || churchName === "-") return null;

      const churchSlug = encodeURIComponent(churchName.toLowerCase().replace(/\s+/g, "-"));
    
      return {
        component: CNavItem,
        name: (
          <div style={{ display: "flex", alignItems: "center", whiteSpace: "normal", wordWrap: "break-word", maxWidth: "150px" }}>
            <CIcon icon={cilList} customClassName="nav-icon" />
            {/* <span>{translations[language].looping} - {churchName}</span> */}
            <span>{churchName}</span>
          </div>
        ),
        to: `/looping-flyer/list/${churchSlug}`,
        style: { margin: "0px 0px 0px 10px" }
      };
    })
    .filter(Boolean);

  const _nav = [
    {
      component: CNavItem,
      name: translations[language].dashboard,
      to: "/dashboard",
      icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
      badge: {
        color: "info",
      },
    },
    isAdmin && {
      component: CNavGroup,
      // name: translations[language].access_management,
      name: translations[language].access,
      icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
      items: [
        {
          component: CNavItem,
          name: translations[language].users,
          icon: (
            <div style={{ display: "flex", alignItems: "center", whiteSpace: "normal", wordWrap: "break-word", maxWidth: "150px" }}>
              <CIcon icon={cilList} customClassName="nav-icon" />
            </div>
          ),
          to: "/role/management/access",
          style: { margin: "0px 0px 0px 10px" }
        },
      ],
    },
    churchIds.length > 0 && {
      component: CNavGroup,
      // name: translations[language].event_management,
      name: translations[language].event,
      icon: <CIcon icon={cilNotes} customClassName="nav-icon" />,
      items: mappedChurches,
    },
    // Hanya menambahkan jika isDepartmentICT atau isDepartmentComm
    (isDepartmentICT || isDepartmentComm) && churchIds.length > 0 && {
      component: CNavGroup,
      // name: translations[language].flyer_management,
      name: translations[language].flyer,
      icon: <CIcon icon={cilCloudUpload} customClassName="nav-icon" />,
      items: mappedFlyers,
    },
    // Hanya menambahkan jika isDepartmentICT atau isDepartmentComm
    (isDepartmentICT || isDepartmentComm) && churchIds.length > 0 && {
      component: CNavGroup,
      // name: translations[language].looping_management,
      name: translations[language].looping,
      icon: <CIcon icon={cilCloudUpload} customClassName="nav-icon" />,
      items: mappedLooping,
    },
    {
      component: CNavTitle,
      name: translations[language].setting,
    },
    {
      component: LogoutButton,
    },
  ].filter(Boolean); // Memastikan tidak ada nilai `false` di dalam array

  return _nav;
};

export default Navigation;