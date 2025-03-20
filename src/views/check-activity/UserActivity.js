import { useEffect, useState, useRef } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../api/configuration";
import debounce from "lodash.debounce";

const useUserActivity = (userId) => {
  const [lastStatus, setLastStatus] = useState(null);
  const inactivityTimerRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const offlineTimeoutRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const userDocRef = doc(db, "users", userId);

    // Fungsi untuk mengupdate status menjadi "Offline" setelah 30 menit tidak aktif
    const setInactive = async () => {
      if (lastStatus !== "Offline") {
        console.log("Updating Status: Offline"); // Logging update
        await updateDoc(userDocRef, { systemstatus: "Offline" });
        setLastStatus("Offline");
      }
    };

    // Fungsi untuk mengupdate status menjadi "Online" saat pengguna aktif
    const setActive = async () => {
      const now = Date.now();
      // Batasi update ke Firestore maksimal sekali setiap 30 detik
      if (lastStatus !== "Online" && now - lastUpdateRef.current > 30000) {
        console.log("Updating Status: Online"); // Logging update
        await updateDoc(userDocRef, { systemstatus: "Online" });
        setLastStatus("Online");
        lastUpdateRef.current = now;
      }
    };

    // Reset timer setiap ada aktivitas
    const resetInactivityTimer = debounce(() => {
      clearTimeout(inactivityTimerRef.current);
      setActive(); // Set status ke Online setiap ada aktivitas
      inactivityTimerRef.current = setTimeout(setInactive, 1800000); // 30 menit
    }, 5000); // Update hanya jika user tidak aktif selama 5 detik

    // Saat aplikasi dimuat, langsung set status ke "Online"
    setActive();

    // Tambahkan event listener untuk mendeteksi aktivitas pengguna
    window.addEventListener("mousemove", resetInactivityTimer);
    window.addEventListener("keydown", resetInactivityTimer);

    // Jika pengguna berpindah tab atau minimize aplikasi
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(setInactive, 1800000); // 30 menit
      } else {
        resetInactivityTimer();
      }
    });

    // Cegah pengguna langsung menjadi "Offline" saat refresh
    window.addEventListener("beforeunload", (event) => {
      if (!navigator.onLine) {
        // Jika user benar-benar offline, update langsung
        setInactive();
      } else {
        // Jika hanya refresh, tunda status Offline selama 5 detik
        offlineTimeoutRef.current = setTimeout(setInactive, 5000);
      }
    });

    // Jika pengguna kembali dalam 5 detik setelah refresh, batalkan perubahan ke Offline
    window.addEventListener("load", () => {
      clearTimeout(offlineTimeoutRef.current);
      setActive();
    });

    return () => {
      clearTimeout(inactivityTimerRef.current);
      clearTimeout(offlineTimeoutRef.current);
      resetInactivityTimer.cancel();
      window.removeEventListener("mousemove", resetInactivityTimer);
      window.removeEventListener("keydown", resetInactivityTimer);
      document.removeEventListener("visibilitychange", resetInactivityTimer);
      window.removeEventListener("beforeunload", setInactive);
      window.removeEventListener("load", setActive);
    };
  }, [userId, lastStatus]);

  return null;
};

export default useUserActivity;