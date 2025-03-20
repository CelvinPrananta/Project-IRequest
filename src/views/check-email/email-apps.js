import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { db, auth } from "../../api/configuration";
import { CSpinner } from "@coreui/react";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

const CheckingWithEmail = () => {
  const navigate = useNavigate();
  const [redirectMessage, setRedirectMessage] = useState(0);
  const [loading, setLoading] = useState(false);
  const authChannel = new BroadcastChannel("auth_channel");

  const messages = [
    "Currently redirecting to login page",
    "Currently redirecting to login page.",
    "Currently redirecting to login page..",
    "Currently redirecting to login page...",
  ];

  // Memeriksa apakah pengguna sudah login menggunakan email
  useEffect(() => {
    const interval = setInterval(() => {
      setRedirectMessage((prevIndex) => (prevIndex + 1) % messages.length);
    }, 750);

    const completeSignIn = async () => {
      // Cek apakah pengguna memilih email sign-in
      const emailSignInUsed = localStorage.getItem("emailSignInUsed");
      
      // Jika pengguna tidak melalui Email Sign-In, kembali ke login
      if (emailSignInUsed !== "true") {
        navigate("/login");
        return;
      }

      if (isSignInWithEmailLink(auth, window.location.href)) {
        setLoading(true);
        let email = localStorage.getItem("emailForSignIn");

        // Jika email tidak ada, minta pengguna memasukkan kembali
        if (!email) {
          email = window.prompt("Please enter your email for confirmation");
          if (!email) {
            navigate("/login");
            return;
          }
        }

        try {
          // Proses sign-in dengan email link
          await signInWithEmailLink(auth, email, window.location.href);
          localStorage.removeItem("emailForSignIn");

          // Periksa apakah Firestore memiliki dokumen dengan email yang sesuai
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDocRef = doc(db, "users", querySnapshot.docs[0].id);

            // Perbarui status sistem hanya jika sign-in berhasil
            if (auth.currentUser) {
              await updateDoc(userDocRef, { systemstatus: "Online" });
            }
          }

          // Tandai bahwa pengguna sudah login
          localStorage.setItem("userLoggedIn", "true");

          // Hapus emailSignInUsed setelah berhasil login
          localStorage.removeItem("emailSignInUsed");

          // Beri tahu tab /login untuk menutup atau redirect
          authChannel.postMessage({ type: "CLOSE_LOGIN_TAB" });
          
          // Simpan info login di sessionStorage agar tidak masuk loop ke /login
          sessionStorage.setItem("loggedIn", "true");

          // Beri tahu tab /login untuk redirect
          authChannel.postMessage({ type: "USER_LOGGED_IN" });

          // Redirect ke dashboard
          navigate("/dashboard");
        } catch (error) {
          console.error("Error during sign-in:", error);
          setTimeout(() => navigate("/login"), 5000);
        }
      } else {
        setLoading(true);
        setTimeout(() => navigate("/login"), 5000);
      }
    };

    completeSignIn();

    return () => clearInterval(interval);
  }, [navigate]);

  // Menutup tab jika menerima perintah dari tab baru
  useEffect(() => {
    authChannel.onmessage = (event) => {
      if (event.data.type === "CLOSE_LOGIN_TAB") {
        window.close();
      }
    };
  }, []);

  return (
    <>
      {loading && (
        <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }}>
          <CSpinner color="primary" className='spinner' />
          <p className='redirect-message mt-3'>{messages[redirectMessage]}</p>
        </div>
      )}
    </>
  );
};

export default CheckingWithEmail;