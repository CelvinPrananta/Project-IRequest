import { useState, useEffect } from 'react'
import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../../api/configuration'
import { getDocs, where, query, collection } from 'firebase/firestore'

export const useAuthRedirect = (redirectPaths) => {
  const [userName, setUserName] = useState('User')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Memeriksa apakah pengguna sudah login
  useEffect(() => {
    let isMounted = true;

    // Daftar rute yang tidak memerlukan autentikasi
    const publicPaths = ['/register', '/SignInWithEmail'];

    // Mengecualikan '/landing/:churchSlug' dari pengecekan autentikasi
    const isLandingPage = matchPath('/landing/:churchSlug', location.pathname);
    
    if (isLandingPage || publicPaths.includes(location.pathname)) {
      return;
    }

    // Periksa status autentikasi
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const checkingEmail = localStorage.getItem("emailForSignIn");

      if (!user && !checkingEmail) {
        // Jika pengguna tidak terautentikasi, arahkan ke halaman login
        if (!redirectPaths.includes(location.pathname)) {
          navigate('/login', { state: { showLoginWarning: true } });
        }
        return;
      }

      if (user) {
        try {
          // Mulai memuat sambil mengambil data pengguna
          setLoading(true);
          
          // Periksa kecocokan email antara Firebase Auth dan Firestore
          const userDocRef = collection(db, "users");
          const queryUserDoc = query(userDocRef, where("email", "==", user.email));
          const userSnapshot = await getDocs(queryUserDoc);

          // Jika data email tidak cocok, paksa logout dan arahkan ke login
          if (userSnapshot.empty) {
            await auth.signOut();
            navigate("/login", { state: { showLoginWarning: true } });
            return;
          }

          // Mengambil data dari Firestore
          const userData = userSnapshot.docs[0].data();

          // Set nama pengguna dari Firestore atau Firebase Auth
          if (isMounted) setUserName(user.displayName || userData.username || "User");
        } catch (error) {
          // Tangani kesalahan tanpa memaksa logout kecuali benar-benar perlu
          console.error("Error fetching user data:", error);
        } finally {
          if (isMounted) setLoading(false); // Hentikan pemuatan setelah data diambil
        }
      }
    });

    // Bersihkan listener ketika komponen onAuthStateChanged tidak lagi digunakan
    return () => { isMounted = false; unsubscribeAuth(); };
  }, [navigate, location.pathname, redirectPaths]);

  return { userName, loading };
};