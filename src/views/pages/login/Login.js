import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { signInWithPopup, GoogleAuthProvider, sendSignInLinkToEmail, OAuthProvider } from "firebase/auth";
import { auth, db } from "../../../api/configuration";
import { getDoc, doc, updateDoc, deleteDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { CButton, CCard, CCardBody, CCardGroup, CCol, CContainer, CForm, CFormInput, CInputGroup, CInputGroupText, CRow, CSpinner, CToast, CToastBody, CToastHeader, CToaster } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilEnvelopeClosed, cilBan, cilArrowThickFromLeft } from '@coreui/icons'
import translations from "../../../../src/language/translations";
import { LanguageContext } from "../../../../src/context/LanguageContext"
import googleLogo from "../../../assets/brand/google-logo.png"
import microsoftLogo from "../../../assets/brand/microsoft-logo.png"
import emailLogo from "../../../assets/brand/email-logo.png"

const Login = () => {
  const [toast, addToast] = useState(null);
  const toaster = useRef();
  const [email, setEmail] = useState("");
  const [error1, setError1] = useState("");
  const [error2, setError2] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState("Currently redirecting to dashboard page");
  const [redirectTarget, setRedirectTarget] = useState(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useContext(LanguageContext);
  const authChannel = new BroadcastChannel("auth_channel");

  useEffect(() => {
    // Periksa apakah sesi pengguna ada di localStorage
    const userSession = localStorage.getItem("userSession");
    if (userSession) {
      // Jika ada sesi, langsung alihkan ke /dashboard
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);
  
  useEffect(() => {
    if (loading) {
      const messages = [
        "Currently redirecting to dashboard page",
        "Currently redirecting to dashboard page.",
        "Currently redirecting to dashboard page..",
        "Currently redirecting to dashboard page...",
      ];
      let index = 0;
      const interval = setInterval(() => {
        if (redirectTarget === '/dashboard') {
          setRedirectMessage(messages[index]);
        }
        index = (index + 1) % messages.length;
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading, redirectTarget]);

  // Toast ketika pengguna melakukan logout
  useEffect(() => {
    if (location.state?.showGoodbyeToast) {
      // Periksa apakah ucapan selamat tinggal sudah ditampilkan di sesi saat ini
      const hasShownGoodbyeToast = localStorage.getItem('goodbyeToastShown');
      
      if (!hasShownGoodbyeToast) {
        const goodbyeToast = (
          <CToast>
            <CToastHeader closeButton>
              <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                <rect width="100%" height="100%" fill="#4caf50"></rect>
              </svg>
              <strong className="me-auto">{translations[language].today_event}</strong>
              <small>{translations[language].just_now}</small>
            </CToastHeader>
            <CToastBody>{translations[language].goodbye_toast}</CToastBody>
          </CToast>
        );
        addToast(goodbyeToast);
  
        // Tetapkan tanda di localStorage untuk mencegah ditampilkannya toast lagi
        localStorage.setItem('goodbyeToastShown', 'true');
      }
    }
  }, [location.state]);

  // Toast ketika pengguna belum login
  useEffect(() => {
    // Cek apakah toast sudah pernah ditampilkan di sesi ini
    const hasShownToast = sessionStorage.getItem('loginWarningToastShown');
  
    // Cek apakah halaman sebelumnya bukan '/register' dan apakah toast belum ditampilkan
    if (!hasShownToast && location.state?.showLoginWarning && location.pathname !== '/register') {
      const warningLoginToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#ffc107"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].warning_login_toast}</CToastBody>
        </CToast>
      );
      addToast(warningLoginToast);
  
      // Tandai bahwa toast telah ditampilkan di sessionStorage
      sessionStorage.setItem('loginWarningToastShown', 'true');
  
      // Hapus state untuk mencegah toast muncul lagi setelah refresh
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    // Cek jika pengguna sudah login (dari tab lain atau session)
    if (localStorage.getItem("userLoggedIn") === "true" || sessionStorage.getItem("loggedIn") === "true") {
      navigate("/dashboard");
    }

    // Dengarkan pesan dari tab lain untuk redirect jika login berhasil atau menutup tab
    authChannel.onmessage = (event) => {
      if (event.data.type === "USER_LOGGED_IN") {
        navigate("/dashboard");
      } else if (event.data.type === "CLOSE_LOGIN_TAB") {
        window.close();
      }
    };

    return () => authChannel.close();
  }, [navigate]);
  
  // Login aplikasi menggunakan Email link
  const handleWithEmail = async () => {
    // Setel ulang kesalahan sebelum mencoba masuk
    setError1("");
    setError2("");
    
    // Validasi input email dan password
    if (!email) {
      setError2(translations[language].email_required);
    } else if (!email.endsWith("@gmail.com") && !email.endsWith("@gms.church")) {
      setError2(translations[language].email_validation);
    }

    // Jika ada kesalahan validasi, hentikan eksekusi
    if (!email || (!email.endsWith("@gmail.com") && !email.endsWith("@gms.church"))) {
      return;
    }

    try {
      // Cek apakah email ada di Firestore Database users
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        // Jika email tidak ditemukan, tampilkan error toast
        const errorToast = (
          <CToast>
            <CToastHeader closeButton>
              <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                <rect width="100%" height="100%" fill="#ff4d4f"></rect>
              </svg>
              <strong className="me-auto">{translations[language].today_event}</strong>
              <small>{translations[language].just_now}</small>
            </CToastHeader>
            <CToastBody>{translations[language].account_not_found_toast}</CToastBody>
          </CToast>
        );
        addToast(errorToast);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      if (userData.accountstatus === "Inactive") {
        const inactiveAccountToast = (
          <CToast>
            <CToastHeader closeButton>
              <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                <rect width="100%" height="100%" fill="#ff4d4f"></rect>
              </svg>
              <strong className="me-auto">{translations[language].today_event}</strong>
              <small>{translations[language].just_now}</small>
            </CToastHeader>
            <CToastBody>{translations[language].deactive_account_toast}</CToastBody>
          </CToast>
        );
        addToast(inactiveAccountToast);
        return;
      }
  
      // Konfigurasi Firebase Email Link Login
      const actionCodeSettings = {
        url: window.location.hostname === "localhost" ? "http://localhost:3000/SignInWithEmail" : "https://today-events.gms.church/SignInWithEmail", // URL apabila pengguna mengklik link di email
        handleCodeInApp: true,
      };
  
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  
      // Simpan email di localStorage untuk otentikasi nanti
      localStorage.setItem("emailForSignIn", email);

      // Tandai bahwa login email sedang digunakan
      localStorage.setItem("emailSignInUsed", "true");
  
      // Tampilkan toast sukses
      const sendingEmailToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#4caf50"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].sending_email_toast}</CToastBody>
        </CToast>
      );
      addToast(sendingEmailToast);
  
    } catch (error) {
      // Tampilkan toast error
      const errorToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#ff4d4f"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].failed_sending_email_toast}</CToastBody>
        </CToast>
      );
      addToast(errorToast);
    }
  };

  // Login aplikasi menggunakan Google Account
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // Masuk dengan Google menggunakan Firebase Auth
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      // Setelah berhasil login Google, ambil data pengguna dari Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
  
      if (!userDocSnap.exists()) {
        // Periksa apakah Firestore memiliki dokumen dengan email yang sama
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
      
        // Default jika tidak ditemukan
        let oldAccountStatus = ["-"];
        let oldChurchId = ["-"];
        let oldCreatedAt = ["-"];
        let oldDepartment = ["-"];
        let oldRole = ["-"];
        let oldSystemStatus = ["-"];
      
        if (!querySnapshot.empty) {
          // Ambil data dari dokumen lama
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.accountstatus, data.church_id, data.createdAt, data.department, data.role, data.systemstatus) {
              oldAccountStatus = data.accountstatus;
              oldChurchId = data.church_id;
              oldCreatedAt = data.createdAt;
              oldDepartment = data.department;
              oldRole = data.role;
              oldSystemStatus = data.systemstatus;
            }
          });

          const userData = querySnapshot.docs[0].data();
          if (userData.accountstatus === "Inactive") {
            const inactiveAccountToast = (
              <CToast>
                <CToastHeader closeButton>
                  <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                    <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                  </svg>
                  <strong className="me-auto">{translations[language].today_event}</strong>
                  <small>{translations[language].just_now}</small>
                </CToastHeader>
                <CToastBody>{translations[language].deactive_account_toast}</CToastBody>
              </CToast>
            );
            addToast(inactiveAccountToast);
            return;
          }
      
          // Buat dokumen baru dengan UID pengguna
          await setDoc(userDocRef, {
            accountstatus: oldAccountStatus,
            church_id: oldChurchId,
            createdAt: oldCreatedAt,
            department: oldDepartment,
            email: user.email,
            role: oldRole,
            systemstatus: oldSystemStatus,
            username: user.displayName || "",
          });

          // Hapus dokumen yang ada dengan email yang sama
          const deletePromises = querySnapshot.docs.map((docSnap) =>
            deleteDoc(doc(db, "users", docSnap.id))
          );
          await Promise.all(deletePromises);
        } else {
          // Pengguna tidak ada di Firestore, tampilkan toast error
          const errorToast = (
            <CToast>
              <CToastHeader closeButton>
                <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                  <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                </svg>
                <strong className="me-auto">{translations[language].today_event}</strong>
                <small>{translations[language].just_now}</small>
              </CToastHeader>
              <CToastBody>{translations[language].account_not_found_toast}</CToastBody>
            </CToast>
          );
          addToast(errorToast);
          setLoading(false);
          return;
        }
      } else {
        const existingData = userDocSnap.data();
        if (existingData.accountstatus === "Inactive") {
          const inactiveAccountToast = (
            <CToast>
              <CToastHeader closeButton>
                <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                  <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                </svg>
                <strong className="me-auto">{translations[language].today_event}</strong>
                <small>{translations[language].just_now}</small>
              </CToastHeader>
              <CToastBody>{translations[language].deactive_account_toast}</CToastBody>
            </CToast>
          );
          addToast(inactiveAccountToast);
          return;
        }
      }

      // Perbarui status sistem ke Online
      await updateDoc(userDocRef, { systemstatus: "Online" });

      // Simpan sesi dan navigasikan ke dasbor
      const updatedUserDoc = await getDoc(userDocRef);
      localStorage.setItem("userSession", JSON.stringify(updatedUserDoc.data()));

      // Tampilkan loading spinner dan arahkan ke dashboard setelah 3 detik
      setLoading(true);
      setRedirectTarget('/dashboard');
      setTimeout(() => {
        navigate("/dashboard", { state: { loginSuccess: true } });
        sessionStorage.setItem("showWelcomeToast", "true");
      }, 3000);
    } catch (error) {
      const errorToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#ff4d4f"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].wrong_google_account_toast}</CToastBody>
        </CToast>
      );
      addToast(errorToast);
      setLoading(false);
    }
  };

  // Login aplikasi menggunakan Microsoft Account
  const handleMicrosoftLogin = async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account', tenant: 'common' });
  
    try {
      // Masuk dengan Microsoft menggunakan Firebase Auth
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      // Periksa apakah pengguna sudah ada di Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
  
      if (!userDocSnap.exists()) {
        // Jika pengguna belum terdaftar, cari berdasarkan email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        // Default jika tidak ditemukan
        let oldAccountStatus = ["-"];
        let oldChurchId = ["-"];
        let oldCreatedAt = ["-"];
        let oldDepartment = ["-"];
        let oldRole = ["-"];
        let oldSystemStatus = ["-"];
      
        if (!querySnapshot.empty) {
          // Ambil data dari dokumen lama
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.accountstatus, data.church_id, data.createdAt, data.department, data.role, data.systemstatus) {
              oldAccountStatus = data.accountstatus;
              oldChurchId = data.church_id;
              oldCreatedAt = data.createdAt;
              oldDepartment = data.department;
              oldRole = data.role;
              oldSystemStatus = data.systemstatus;
            }
          });

          const userData = querySnapshot.docs[0].data();
          if (userData.accountstatus === "Inactive") {
            const inactiveAccountToast = (
              <CToast>
                <CToastHeader closeButton>
                  <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                    <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                  </svg>
                  <strong className="me-auto">{translations[language].today_event}</strong>
                  <small>{translations[language].just_now}</small>
                </CToastHeader>
                <CToastBody>{translations[language].deactive_account_toast}</CToastBody>
              </CToast>
            );
            addToast(inactiveAccountToast);
            return;
          }

          // Buat dokumen baru dengan UID pengguna
          await setDoc(userDocRef, {
            accountstatus: oldAccountStatus,
            church_id: oldChurchId,
            createdAt: oldCreatedAt,
            department: oldDepartment,
            email: user.email,
            role: oldRole,
            systemstatus: oldSystemStatus,
            username: user.displayName || "",
          });

          // Hapus dokumen yang ada dengan email yang sama
          const deletePromises = querySnapshot.docs.map((docSnap) =>
            deleteDoc(doc(db, "users", docSnap.id))
          );
          await Promise.all(deletePromises);
        } else {
          // Pengguna tidak ada di Firestore, tampilkan toast error
          const errorToast = (
            <CToast>
              <CToastHeader closeButton>
                <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                  <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                </svg>
                <strong className="me-auto">{translations[language].today_event}</strong>
                <small>{translations[language].just_now}</small>
              </CToastHeader>
              <CToastBody>{translations[language].account_not_found_toast}</CToastBody>
            </CToast>
          );
          addToast(errorToast);
          setLoading(false);
          return;
        }
      } else {
        const existingData = userDocSnap.data();
        if (existingData.accountstatus === "Inactive") {
          const inactiveAccountToast = (
            <CToast>
              <CToastHeader closeButton>
                <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
                  <rect width="100%" height="100%" fill="#ff4d4f"></rect>
                </svg>
                <strong className="me-auto">{translations[language].today_event}</strong>
                <small>{translations[language].just_now}</small>
              </CToastHeader>
              <CToastBody>{translations[language].deactive_account_toast}</CToastBody>
            </CToast>
          );
          addToast(inactiveAccountToast);
          return;
        }
      }
  
      // Perbarui status pengguna yang sudah ada atau ditemukan berdasarkan email
      await updateDoc(userDocRef, { systemstatus: "Online" });
  
      // Simpan sesi pengguna
      const updatedUserDoc = await getDoc(userDocRef);
      localStorage.setItem("userSession", JSON.stringify(updatedUserDoc.data()));
  
      // Navigasi ke dashboard dengan delay untuk menampilkan loading spinner
      setLoading(true);
      setRedirectTarget('/dashboard');
      setTimeout(() => {
        navigate("/dashboard", { state: { loginSuccess: true } });
        sessionStorage.setItem("showWelcomeToast", "true");
      }, 3000);
    } catch (error) {
      // Tampilkan pesan error jika terjadi masalah saat login
      const errorToast = (
        <CToast>
          <CToastHeader closeButton>
            <svg className="rounded me-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img">
              <rect width="100%" height="100%" fill="#ff4d4f"></rect>
            </svg>
            <strong className="me-auto">{translations[language].today_event}</strong>
            <small>{translations[language].just_now}</small>
          </CToastHeader>
          <CToastBody>{translations[language].wrong_microsoft_account_toast}</CToastBody>
        </CToast>
      );
      addToast(errorToast);
      setLoading(false);
    }
  };

  // Menampilkan fields login dengan email
  const handleShowFieldsEmail = () => {
    setShowLoginForm(prev => {
      if (prev) {
        setEmail("");
        setError1("");
        setError2("");
      }
      return !prev;
    });
  };
  
  return (
    <div className={`bg-body-tertiary min-vh-100 d-flex flex-row align-items-center`}>
      <CContainer>

        {/* Loading overlay */}
        {loading && (
          <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }}>
            <CSpinner color="primary" className='spinner' />
            <p className='redirect-message mt-3'>{redirectMessage}</p>
          </div>
        )}
        
        <CToaster ref={toaster} push={toast} placement="top-end" />
        <CRow className={`justify-content-center ${loading ? 'blur' : ''}`}>
          <CCol md={8}>
            <CCardGroup>
              <CCard className="p-4">
                <CCardBody>
                  <CForm onSubmit={(e) => e.preventDefault()}>
                    <p className="text-body-secondary login-title">{translations[language].header_title_login}</p>
                    
                      <div className='container-account'>
                        {/* Tombol masuk dengan Google */}
                        <div className="text-center mb-4 google-container">
                          <CButton color="link" className="d-flex justify-content-center align-items-center hover-effect link" onClick={handleGoogleLogin}>
                            <img className='img' src={googleLogo} alt="google-logo" />
                          </CButton>
                        </div>

                        {/* Tombol masuk dengan Microsoft */}
                        <div className="text-center mb-4 microsoft-container">
                          <CButton color="link" className="d-flex justify-content-center align-items-center hover-effect link" onClick={handleMicrosoftLogin}>
                            <img className='img' src={microsoftLogo} alt="microsoft-logo" />
                          </CButton>
                        </div>

                        {/* Tombol masuk dengan Email */}
                        <div className="text-center mb-4 email-container">
                          <CButton color="link" className="d-flex justify-content-center align-items-center hover-effect link" onClick={handleShowFieldsEmail}>
                            <img className='img' src={emailLogo} alt="email-logo" />
                          </CButton>
                        </div>
                      </div>

                      {showLoginForm && (
                        <div>
                          {/* Pembagi dengan "atau" */}
                          <div className="d-flex align-items-center mb-4">
                            <div className='divider-login'></div>
                            <p className="text-center text-muted mx-2 mb-0">{translations[language].or}</p>
                            <div className='divider-login'></div>
                          </div>

                          {error1 && <p className='error-general'>{error1}</p>}
                          <CInputGroup className="mb-3">
                            <CInputGroupText>
                              <CIcon icon={cilEnvelopeClosed} />
                            </CInputGroupText>
                            <CFormInput type="email" placeholder={translations[language].enter_email_login} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={error2 ? "is-invalid" : ""} />
                          </CInputGroup>
                          {error2 && <p className='error-email'>{error2}</p>}
                          <CRow>
                            <CCol xs={5}>
                              <CButton color="primary" className="px-4" onClick={handleWithEmail}>
                                <CIcon icon={cilArrowThickFromLeft} className="me-1" />{translations[language].login}
                              </CButton>
                            </CCol>
                            <CCol xs={5}>
                              <CButton color="primary" className="px-4" onClick={() => { setShowLoginForm(false); setEmail(""); setError1(""); setError2("") }}>
                                <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
                              </CButton>
                            </CCol>
                          </CRow>
                        </div>
                      )}
                  </CForm>
                </CCardBody>
              </CCard>
              <CCard className="text-white bg-primary py-5">
                <CCardBody className="text-center">
                  <div>
                    <h2><i>{translations[language].header_title_app}</i></h2>
                    <p>{translations[language].info_app1} <i>{translations[language].info_app2}</i>, {translations[language].info_app3}</p>
                    <div className='container-copyright'>
                      <strong className='text-copyright'>&copy;2024 - {new Date().getFullYear()} <Link to="https://gms.church/id" className='link-copyright no-underline' target="_blank">GMS.</Link></strong>
                      <p className='text-reserved'>{translations[language].all_rights_reserved}</p>
                    </div>
                  </div>
                </CCardBody>
              </CCard>
            </CCardGroup>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Login