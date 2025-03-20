import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../api/configuration";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { CSpinner, CToast, CToastBody, CToastHeader, CToaster, CCol, CCard, CCardHeader, CCardBody, CFormSelect } from '@coreui/react';
import { FaUsers, FaUserCircle, FaRegUserCircle } from "react-icons/fa";
import translations from "../../language/translations";
import { LanguageContext } from "../../context/LanguageContext"
import { API_BASE_URL } from "../../api/base";

const Dashboard = () => {
  const [greeting, setGreeting] = useState("");
  const [userName, setUserName] = useState("User");
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading');
  const [dataPengguna, setDataPengguna] = useState(0);
  const [dataOnline, setDataOnline] = useState(0);
  const [dataOffline, setDataOffline] = useState(0);
  const navigate = useNavigate();
  const slideCardRef = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, addToast] = useState(null);
  const toaster = useRef();
  const { language } = useContext(LanguageContext);
  const [events, setEvents] = useState([]);
  const [churchId, setChurchId] = useState(null);
  const [churches, setChurches] = useState([]);
  const [userChurchIds, setUserChurchIds] = useState([]);
  const user = auth.currentUser; 
  const userEmail = user?.email || "";
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 3;
  const autoSlideInterval = 8000; // 8 detik

  // Memeriksa apakah pengguna sudah login
  useEffect(() => {
    let isMounted = true;

    // Periksa status autentikasi
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Jika pengguna tidak terautentikasi, arahkan ke halaman login
        navigate("/login", { state: { showLoginWarning: true } });
        return;
      }

      try {
        setLoading(true); // Mulai memuat sambil mengambil data pengguna
          
        // Jika tidak ada displayName, ambil dari Firestore
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
          // Dokumen pengguna tidak ditemukan, paksa logout dan arahkan ke login
          await auth.signOut();
          navigate("/login", { state: { showLoginWarning: true } });
          return;
        }

        const userData = docSnap.data();

        // Periksa kecocokan email antara Firebase Auth dan Firestore
        if (user.email !== userData.email) {
          await auth.signOut();
          navigate("/login", { state: { showLoginWarning: true } });
          return;
        }

        // Set Nama Pengguna
        isMounted && setUserName(user.displayName || userData.username || "User");
  
        // Set Admin Status
        isMounted && setIsAdmin(userData.role === "Admin");

        // Sinkronisasi Data Pengguna Secara Real-Time
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists() && isMounted) {
            const userData = docSnap.data();
            setIsAdmin(userData.role === "Admin");
          }
        });

        // Monitor Status Semua Pengguna
        const statsCollectionRef = collection(db, "users");
        const unsubscribeStatus = onSnapshot(statsCollectionRef, (snapshot) => {
          if (isMounted) {
            const statsData = snapshot.docs.map((doc) => doc.data());
            setDataPengguna(statsData.length);
            setDataOnline(statsData.filter((user) => user.systemstatus === "Online").length);
            setDataOffline(statsData.filter((user) => user.systemstatus === "Offline").length);
          }
        });

        // Bersihkan listener ketika komponen unsubscribeUser dan unsubscribeStatus tidak lagi digunakan
        return () => { isMounted = false; unsubscribeUser(); unsubscribeStatus() };
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        isMounted && setLoading(false);
      }
    });

    // Bersihkan listener ketika komponen onAuthStateChanged tidak lagi digunakan
    return () => { isMounted = false; unsubscribeAuth() };
  }, [navigate]);

  // Memunculkan toast ketika pengguna melakukan login
  useEffect(() => {
    const showToastWelcome = sessionStorage.getItem("showWelcomeToast");
  
    if (showToastWelcome) {
      const welcomeToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#4caf50"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].welcome_toast}</CToastBody>
        </CToast>
      );
  
      addToast(welcomeToast);

      // Hapus setelah ditampilkan
      sessionStorage.removeItem("showWelcomeToast");
    }
  }, []);

  // Untuk membuat tulisan loading bergerak
  useEffect(() => {
    let dotCount = 0;
    const interval = setInterval(() => {
      dotCount = (dotCount + 1) % 4; // Mengulang dari 0 ke 3
      setLoadingText(`Loading${'.'.repeat(dotCount)}`);
    }, 500); // Update setiap 500ms

    return () => clearInterval(interval); // Membersihkan interval saat komponen unmount
  }, []);

  useEffect(() => {
    const currentHour = new Date().getHours();
  
    const greetingText =
      currentHour < 12 ? translations[language].good_morning :
      currentHour < 16 ? translations[language].good_afternoon :
      currentHour < 18 ? translations[language].good_evening :
      translations[language].good_night;
  
    setGreeting(`${greetingText},`);
    
  // Pastikan greeting berubah saat bahasa berubah
  }, [language]);

  // Untuk mendapatkan Jumlah Pengguna, Online, dan Offline
  useEffect(() => {
    const fetchData = async () => {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const users = usersSnapshot.docs.map(doc => doc.data());
      
      setDataPengguna(users.length);
      setDataOnline(users.filter(user => user.systemstatus === "Online").length);
      setDataOffline(users.filter(user => user.systemstatus === "Offline").length);
    };

    fetchData();
  }, []);

  // Untuk mengatur slide card
  const handleMouseDown = (e) => {
    if (!slideCardRef.current) return;
    setIsDown(true);
    setStartX(e.pageX - slideCardRef.current.offsetLeft);
    setScrollLeft(slideCardRef.current.scrollLeft);
    slideCardRef.current.style.cursor = 'grabbing';
  };

  const handleMouseLeave = () => {
    setIsDown(false);
    if (slideCardRef.current) slideCardRef.current.style.cursor = 'grab';
  };

  const handleMouseUp = () => {
    setIsDown(false);
    if (slideCardRef.current) slideCardRef.current.style.cursor = 'grab';
  };

  const handleMouseMove = (e) => {
    if (!isDown || !slideCardRef.current) return;
    e.preventDefault();
    const x = e.pageX - slideCardRef.current.offsetLeft;
    const walkX = (x - startX) * 1;
    slideCardRef.current.scrollLeft = scrollLeft - walkX;
  };

  const slideContent = (direction) => {
    if (!slideCardRef.current) return;
    const scrollAmount = 300;
    slideCardRef.current.scrollLeft += direction === 'left' ? -scrollAmount : scrollAmount;
  };

  // Ambil church_id dari Firestore berdasarkan email pengguna
  const fetchUserChurchIds = async () => {
    try {
      const userRef = collection(db, "users");
      const q = query(userRef, where("email", "==", userEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        setUserChurchIds(userData.church_id || []); // Simpan daftar church_id dari Firestore
      }
    } catch (error) {
      console.error("Error fetching user church_id:", error);
    }
  };

  // Ambil daftar gereja dari API
  const fetchChurches = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}`);
      if (!response.ok) {
        throw new Error("Failed to fetch churches");
      }
      const data = await response.json();

      // Format nama dan filter hanya gereja yang dimiliki pengguna
      const churchesList = data.result.rows
        .filter((church) => userChurchIds.includes(church.church_id)) // Hanya yang sesuai
        .map((church) => ({
          id: church.church_id,
          name: church.name.replace(/GMS\s*/i, "").trim(), // Hilangkan "GMS"
        }));

      setChurches(churchesList);

      if (churchesList.length > 0) {
        setChurchId(churchesList[0].id); // Default ke church_id pertama
      }
    } catch (error) {
      console.error("Error fetching API church:", error);
    }
  };

  // Fetch data saat komponen dimuat
  useEffect(() => {
    if (userEmail) {
      fetchUserChurchIds();
    }
  }, [userEmail]);

  useEffect(() => {
    if (userChurchIds.length > 0) {
      fetchChurches();
    }
  }, [userChurchIds]);
  
  // Ambil event berdasarkan churchId secara realtime
  useEffect(() => {
    if (!churchId) return;

    const eventsRef = doc(db, "events", churchId);
    const unsubscribe = onSnapshot(eventsRef, (docSnap) => {
      if (docSnap.exists()) {
        const eventData = docSnap.data();
        const filteredEvents = filterEventsByEndTime(eventData.event_list || []);
        setEvents(filteredEvents);
        setCurrentPage(1); // Reset ke halaman pertama setiap kali data berubah
      } else {
        setEvents([]);
      }
    });

    return () => unsubscribe();
  }, [churchId]);

  // Fungsi filter event berdasarkan waktu
  const filterEventsByEndTime = (events) => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibNow = new Date(utc + 7 * 3600000); // WIB

    const today = wibNow.toISOString().split("T")[0];
    const yesterday = new Date(wibNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    return events
      .filter((event) => {
        if (!event.endTime || !event.startTime || !event.created_at || !event.date) return false;

        const eventDate = event.date;
        const eventCreatedAt = new Date(event.created_at);
        const eventCreatedAtStr = eventCreatedAt.toISOString().split("T")[0];

        const eventEndTime = new Date(wibNow);
        const [endHours, endMinutes] = event.endTime.split(":");
        eventEndTime.setHours(parseInt(endHours, 10));
        eventEndTime.setMinutes(parseInt(endMinutes, 10));
        eventEndTime.setSeconds(0);

        if (eventCreatedAtStr === yesterdayStr && eventDate === today) {
          return eventEndTime.getTime() > wibNow.getTime();
        }

        return eventDate === today && eventEndTime.getTime() > wibNow.getTime();
      })
      .sort((a, b) => {
        const parseEventTime = (date, timeString) => {
          const [hours, minutes] = timeString.split(":").map(Number);
          const eventDateTime = new Date(date);
          eventDateTime.setHours(hours, minutes, 0, 0);
          return eventDateTime;
        };

        const aStart = parseEventTime(a.date, a.startTime);
        const bStart = parseEventTime(b.date, b.startTime);

        return aStart - bStart;
      });
  };

  // Fungsi untuk mendapatkan event pada halaman tertentu
  const paginatedEvents = () => {
    const startIndex = (currentPage - 1) * eventsPerPage;
    return events.slice(startIndex, startIndex + eventsPerPage);
  };

  // Hitung total halaman
  const totalPages = Math.ceil(events.length / eventsPerPage);

  // Efek untuk auto-pagination setiap 5 detik
  useEffect(() => {
    if (events.length <= eventsPerPage) return; // Tidak perlu slide jika event <= 3

    const interval = setInterval(() => {
      setCurrentPage((prevPage) => (prevPage < totalPages ? prevPage + 1 : 1));
    }, autoSlideInterval);

    return () => clearInterval(interval); // Hentikan interval saat unmount
  }, [events, totalPages]);

  return (
    <div className="page-wrapper">
      <CToaster ref={toaster} push={toast} placement="top-end" />

      {/* Page Header */}
      <div className="content container-fluid">
        <div className="page-header">
          <div className="row">
            <div className="col-sm-12">
              <h3 className="page-title">
                {greeting} {userName} &#128522;
              </h3>
              <ul className="breadcrumb">
                <li className="breadcrumb-item active">
                  <b>{userName}'s</b> {translations[language].dashboard}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        {loading && (
          <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }} >
            <CSpinner color="primary" className="spinner" />
            <p className="redirect-message mt-3">{loadingText}</p>
          </div>
        )}

        {isAdmin && (
          <div className="container">
            <div className="action-buttons">
              <button className="action-button1" onClick={() => slideContent('left')}></button>
              <button className="action-button2" onClick={() => slideContent('right')}></button>
            </div>
            <div id="slide-card" ref={slideCardRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} style={{ overflowX: 'auto', whiteSpace: 'nowrap', cursor: 'grab' }}>
              <a href="#" className="slide-cards">
                <span className="dash-widget-icon"><FaUsers /></span>
                <div>
                  <h2>{dataPengguna}</h2>
                  <br />
                  <div className="title-card">{translations[language].number_of_users}</div>
                </div>
              </a>
              <a href="#" className="slide-cards">
                <span className="dash-widget-icon"><FaUserCircle /></span>
                <div>
                  <h2>{dataOnline}</h2>
                  <br />
                  <div className="title-card">{translations[language].online_users}</div>
                </div>
              </a>
              <a href="#" className="slide-cards">
                <span className="dash-widget-icon"><FaRegUserCircle /></span>
                <div>
                  <h2>{dataOffline}</h2>
                  <br />
                  <div className="title-card">{translations[language].offline_users}</div>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>
      <CCol xs={12}>
        <CCard className="mb-4">
          <CCardHeader>
            <div className="header-conntainer">
              <span className={`red-dot ${events.length === 0 ? "stop-blink" : ""}`}></span>
              <strong>{translations[language].preview_ongoing_event}</strong>

              {/* Dropdown Select Church */}
              <div className="select-church">
                {churches.length > 1 && (
                  <CFormSelect value={churchId || ""} onChange={(e) => setChurchId(e.target.value)}>
                    <option value="" disabled>{translations[language].select_local_church}</option> 
                    {churches.map((church) => (
                      <option key={church.id} value={church.id}>
                        {church.name}
                      </option>
                    ))}
                  </CFormSelect>
                )}
              </div>
            </div>
          </CCardHeader>

          {/* Card untuk Event */}
          <CCardBody className="table-background">
            <div className="table-responsive mt-3">
              {events.length > 0 ? (
                <div className="event-container">
                  {paginatedEvents().map((event, index) => (
                    <div key={index} className="event">
                      <h4 className="title">{event.title.toUpperCase()}</h4>
                      <div className="event-details">
                        <p className="location">{event.location.toUpperCase()}</p>
                        <p className="floor">{event.floor.toUpperCase()}<sup>{event.textfloor || "FL"}</sup></p>
                        <p className="time">{event.startTime} - {event.endTime} <span className="wib">WIB</span></p>
                      </div>
                    </div>
                  ))}

                  {/* Pagination Indicator */}
                  <div className="text-center text-gray-400 mt-4 page-halaman">
                    {currentPage} dari {totalPages}
                  </div>
                </div>
              ) : (
                <p className="no_events">{translations[language].no_events}</p>
              )}
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </div>
  )
}

export default Dashboard