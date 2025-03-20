import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../../../api/configuration";
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { CButton, CCard, CCardBody, CCol, CContainer, CForm, CFormInput, CInputGroup, CInputGroupText, CRow, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import GoogleLogo from '../../../assets/brand/google-logo.png';

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [error1, setError1] = useState("");
  const [error2, setError2] = useState("");
  const [error3, setError3] = useState("");
  const [error4, setError4] = useState("");
  const [error5, setError5] = useState("");
  const [error6, setError6] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState("Currently redirecting to login page");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const navigate = useNavigate();

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
        "Currently redirecting to login page",
        "Currently redirecting to login page.",
        "Currently redirecting to login page..",
        "Currently redirecting to login page...",
      ];
      let index = 0;
      const interval = setInterval(() => {
        setRedirectMessage(messages[index]);
        index = (index + 1) % messages.length;
      }, 500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  const handleRegister = async () => {
    // Setel ulang kesalahan sebelum mencoba masuk
    setError("");
    setError1("");
    setError2("");
    setError3("");
    setError4("");
    setError5("");
    setError6("");

    // Validasi input username, email, password dan repeat password
    if (!username) {
      setError1("Username field is required.");
    }

    if (!email) {
      setError2("Email field is required.");
    } else if (!email.endsWith("@gmail.com")) {
      setError2("Email must be a valid @gmail.com address.");
    }

    if (!password) {
      setError3("Password field is required.");
    } else if (password !== password2) {
      setError5("Password doesn't match the repeat password");
    }

    if (!password2) {
      setError4("Repeat password field is required.");
    }  else if (password2 !== password) {
      setError6("Repeat password doesn't match password");
    }

    // Jika ada kesalahan validasi, hentikan eksekusi
    if (!username || !email || !email.endsWith("@gmail.com") || !password || !password2 || password !== password2 || password2 !== password) {
      return;
    }

    try {
      // Daftarkan pengguna dengan Autentikasi Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan data pengguna ke Firestore
      await setDoc(doc(db, "users", user.uid), {
        username,
        email,
        createdAt: new Date().toISOString()
      });

      // Memicu loading spinner dan efek blur
      setLoading(true);
      setTimeout(() => {
        // Tambahkan state untuk menampilkan warning login toast
        navigate('/login', { state: { showLoginWarning: true } });
      }, 3000); // Diarahkan ke login setelah 3 detik
    } catch (err) {
      // Menangani kode kesalahan tertentu
      if (err.code === 'auth/email-already-in-use') {
        setError("The email you entered has been used, please try again.");
      } else {
        setError(err.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // Masuk dengan Google menggunakan Firebase Auth
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
  
      // Periksa apakah pengguna ada di Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
  
      if (!userDocSnap.exists()) {
        // Simpan data pengguna ke Firestore
        await setDoc(userDocRef, {
          username: user.displayName || "",
          email: user.email,
          createdAt: new Date().toISOString()
        });
      }
      
      // Diarahkan ke login
      setLoading(true);
      setTimeout(() => {
        // Tambahkan state untuk menampilkan warning login toast
        navigate('/login', { state: { showLoginWarning: true } });
      }, 3000); // Diarahkan ke login setelah 3 detik
    } catch (error) {
      setError1("Something went wrong with Google login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className={`bg-body-tertiary min-vh-100 d-flex flex-row align-items-center`}>
      <CContainer>
        {loading && (
          <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }}>
            <CSpinner color="primary" className='spinner' />
            <p className='redirect-message mt-3'>{redirectMessage}</p>
          </div>
        )}
        <CRow className={`justify-content-center ${loading ? 'blur' : ''}`}>
          <CCol md={9} lg={7} xl={6}>
            <CCard className="mx-4">
              <CCardBody className="p-4">
                <CForm onSubmit={(e) => e.preventDefault()}>
                  <h1>Register</h1>
                  <p className="text-body-secondary">Create your account</p>

                    {/* Tombol masuk dengan Google */}
                    <div className="text-center mb-4">
                      <CButton color="link" className="d-flex justify-content-center align-items-center" style={{ maxWidth: '300px', margin: '0 auto', padding: '12px 20px', borderRadius: '5px', border: '1px solid #dadce0', fontSize: '16px' }} onClick={handleGoogleLogin}>
                        <img src={GoogleLogo} alt="Google logo" style={{ width: '1.3rem' }} />
                      </CButton>
                    </div>

                    {/* Pembagi dengan "atau" */}
                    <div className="d-flex align-items-center mb-4">
                      <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#dadce0' }}></div>
                      <p className="text-center text-muted mx-2 mb-0">or</p>
                      <div style={{ flexGrow: 1, height: '1px', backgroundColor: '#dadce0' }}></div>
                    </div>

                  {error && <p className='error-general'>{error}</p>}
                  <CInputGroup className="mb-3">
                    <CInputGroupText>
                      <CIcon icon={cilUser} />
                    </CInputGroupText>
                    <CFormInput type="text" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </CInputGroup>
                  {error1 && <p className='error-username'>{error1}</p>}
                  <CInputGroup className="mb-3">
                    <CInputGroupText>@</CInputGroupText>
                    <CFormInput type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </CInputGroup>
                  {error2 && <p className='error-email'>{error2}</p>}
                  <CInputGroup className="mb-4">
                    <CInputGroupText>
                     <CIcon icon={cilLockLocked} /> 
                    </CInputGroupText>
                    <CFormInput type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <CButton color="primary" className="password-toggle p-2 d-flex align-items-center justify-content-center border" onClick={() => setShowPassword(!showPassword)} style={{ borderRadius: '0 5px 5px 0' }} >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </CButton>
                  </CInputGroup>
                  {error3 && <p className='error-password'>{error3}</p>}
                  {error5 && <p className='error-password'>{error5}</p>}
                  <CInputGroup className="mb-4">
                    <CInputGroupText>
                     <CIcon icon={cilLockLocked} />
                    </CInputGroupText>
                    <CFormInput type={showPassword2 ? "text" : "password"} placeholder="Enter repeat password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                    <CButton color="primary" className="password-toggle p-2 d-flex align-items-center justify-content-center border" onClick={() => setShowPassword2(!showPassword2)} style={{ borderRadius: '0 5px 5px 0' }} >
                      <FontAwesomeIcon icon={showPassword2 ? faEyeSlash : faEye} />
                    </CButton>
                  </CInputGroup>
                  {error4 && <p className='error-password2'>{error4}</p>}
                  {error6 && <p className='error-password2'>{error6}</p>}
                  <div className="d-grid">
                    <CButton color="success" onClick={handleRegister}>Create Account</CButton>
                  </div>
                </CForm>
                <div className='container-already'>
                  <p className='text-already text-body-secondary'>Already have an account?</p>
                  <strong><Link className='no-underline' color="primary" to="/login">Login</Link></strong>
                </div>
              </CCardBody>
              <div className='container-copyright'>
                <strong className='text-copyright text-body-secondary'>&copy;2023 - {new Date().getFullYear()} GMS.</strong>
                <p className='text-reserved text-body-secondary'>All rights reserved.</p>
              </div>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Register