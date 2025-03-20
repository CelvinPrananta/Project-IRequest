import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../api/configuration';
import '../landing/assets/style.css';
import { API_BASE_URL } from "../../api/base";

const LandingPage = () => {
    // State untuk gambar dan jadwal acara dari Firebase
    const [images, setImages] = useState([]);
    const [eventData, setEventData] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isImageTransitioning, setIsImageTransitioning] = useState(false);
    const [currentEventIndex, setCurrentEventIndex] = useState(0);
    const [isEventTransitioning, setIsEventTransitioning] = useState(false);
    const [loopingImages, setLoopingImages] = useState([]);
    const [loopingCurrentImageIndex, setLoopingCurrentImageIndex] = useState(0);
    const [showLoopingImages, setShowLoopingImages] = useState(false);

    // Ambil data gereja dari API
    const [churchId, setChurchId] = useState(null);

    // Ambil churchSlug dari URL
    const { churchSlug } = useParams();

    // Ref untuk kontainer utama
    const containerRef = useRef(null);

    // Format tanggal untuk Indonesia
    const getFormattedDate = () => {
        const date = new Date();
    
        // Konversi waktu ke zona WIB (GMT+7)
        const utc = date.getTime() + date.getTimezoneOffset() * 60000; // Waktu UTC
        const wibTime = new Date(utc + 7 * 3600000); // Tambahkan offset GMT+7
    
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Intl.DateTimeFormat('id-ID', options).format(wibTime);
    };

    // Ambil data gereja secara realtime
    useEffect(() => {
        const fetchChurchId = async () => {
          try {
            const response = await fetch(`${API_BASE_URL}`);
            if (!response.ok) {
              throw new Error("Failed to fetch churches");
            }
    
            const data = await response.json();
    
            // Pastikan ini adalah array dari API
            const churches = data.result.rows;
    
            // Rebuild churchSlug untuk memastikan GMS ada di dalamnya
            let adjustedChurchSlug = churchSlug;
            if (!adjustedChurchSlug.includes('gms')) {
              adjustedChurchSlug = `gms-${adjustedChurchSlug}`;
            }
    
            // Cari church yang sesuai berdasarkan adjustedChurchSlug
            const matchedChurch = churches.find(church => {
              const slugFromAPI = encodeURIComponent(church.name.toLowerCase().replace(/\s+/g, "-"));
    
              // Bandingkan slug dengan yang sudah di-adjust
              return slugFromAPI === adjustedChurchSlug;
            });
    
            if (matchedChurch) {
              // Simpan church_id jika ditemukan
              setChurchId(matchedChurch.church_id);
            } else {
              console.error("Church ID not found for slug:", adjustedChurchSlug);
            }
          } catch (error) {
            console.error("Error fetching church ID:", error);
          }
        };
      
        fetchChurchId();
    }, [churchSlug]);

    // Ambil gambar dan jadwal acara dari Firebase
    useEffect(() => {
        if (!churchId) return;
        
        // Mengambil data gambar berdasarkan churchId dari Firestore
        const imagesRef = collection(db, `flyers/${churchId}/flyer_list`);
        const unsubscribeFlyers = onSnapshot(imagesRef, (snapshot) => {
            const loadedImages = snapshot.docs.map((doc) => doc.data().image); // Ambil URL gambar
            setImages(loadedImages);
        }, (error) => {
            console.error("Error fetching flyer images:", error);
        });

        // Mengambil data gambar looping berdasarkan churchId dari Firestore
        const loopingImagesRef = collection(db, `loopings/${churchId}/looping_list`);
        const unsubscribeLoopings = onSnapshot(loopingImagesRef, (snapshot) => {
            const loopingLoadedImages = snapshot.docs.map((doc) => doc.data().image); // Ambil URL gambar
            setLoopingImages(loopingLoadedImages);
        }, (error) => {
            console.error("Error fetching looping images:", error);
        });

        // Mengambil data gambar dari API
        // const fetchImages = async () => {
        //     try {
        //         const response = await fetch('https://api-v2.gms.church/events?church_id=');
        //         if (!response.ok) {
        //             throw new Error(`HTTP error! Status: ${response.status}`);
        //         }
        //         const data = await response.json();
        //         console.log("Fetched data:", data);
        
        //         // Periksa apakah data adalah array
        //         if (!Array.isArray(data)) {
        //             console.error("Unexpected data structure (expected array):", data);
        //             return;
        //         }
        
        //         // Ambil semua gambar yang memiliki "/768"
        //         let loadedImages = data.flatMap(event => 
        //             event.images && Array.isArray(event.images)
        //                 ? event.images
        //                     .filter(image => image.url.includes('/768'))
        //                     .map(image => image.url)
        //                 : []
        //         );
        
        //         // Jika tidak ada gambar dengan "/768", ambil semua gambar yang ada
        //         if (loadedImages.length === 0) {
        //             loadedImages = data.flatMap(event => 
        //                 event.images && Array.isArray(event.images)
        //                     ? event.images.map(image => image.url)
        //                     : []
        //             );
        //             console.warn("No images with '/768' found, using all available images instead.");
        //         }
        
        //         console.log("Filtered images:", loadedImages);
        //         setImages(loadedImages);
        //     } catch (error) {
        //         console.error('Error fetching images:', error);
        //     }
        // };
        
        // Mengatur pengecekan kondisi pada jadwal acara
        const filterEventsByEndTime = (events) => {
            const now = new Date();
            const utc = now.getTime() + now.getTimezoneOffset() * 60000;
            const wibNow = new Date(utc + 7 * 3600000); // Waktu Indonesia Barat

            // Format tanggal hari ini dalam format YYYY-MM-DD
            const today = wibNow.toISOString().split('T')[0];

            // Format tanggal kemarin
            const yesterday = new Date(wibNow);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
        
            // Format tanggal besok
            const tomorrow = new Date(wibNow);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            // Filter event
            const filteredEvents = events.filter((event) => {
                // Validasi data event
                if (!event.endTime || !event.startTime || !event.created_at || !event.date) {
                    return false;
                }

                // Cek apakah event sesuai dengan tanggal hari ini
                const eventDate = event.date;

                // Konversi `created_at` ke objek Date
                const eventCreatedAt = new Date(event.created_at);

                const eventCreatedAtStr = eventCreatedAt.toISOString().split('T')[0];

                // Konversi `endTime` berdasarkan `wibNow`
                const eventEndTime = new Date(wibNow);
                const [endHours, endMinutes] = event.endTime.split(':');
                eventEndTime.setHours(parseInt(endHours, 10));
                eventEndTime.setMinutes(parseInt(endMinutes, 10));
                eventEndTime.setSeconds(0);
        
                // Jika event dibuat kemarin tapi dijadwalkan untuk hari ini, tetap ditampilkan
                if (eventCreatedAtStr === yesterdayStr && eventDate === tomorrowStr && today === eventDate) {
                    return eventEndTime.getTime() > wibNow.getTime();
                }
        
                // Jika event dibuat di masa lalu dan juga dijadwalkan di masa lalu, sembunyikan
                if (eventCreatedAtStr < today && eventDate < today) {
                    return false;
                }
        
                // Jika event dibuat hari ini tapi dijadwalkan untuk besok, data muncul saat event.date = today
                if (eventCreatedAtStr === today && eventDate === tomorrowStr) {
                    return false;
                }
        
                // Jika event sesuai dengan hari ini, tetap ditampilkan
                const isToday = eventDate === today;

                if (!isToday) { return eventEndTime.getTime() > wibNow.getTime(); }

                // Konversi `startTime`
                const eventStartTime = new Date(eventCreatedAt);
                const [startHours, startMinutes] = event.startTime.split(':');
                eventStartTime.setHours(parseInt(startHours, 10));
                eventStartTime.setMinutes(parseInt(startMinutes, 10));
                eventStartTime.setSeconds(0);
        
                // Event di masa depan
                const isEventInFuture = eventCreatedAt.getTime() > wibNow.getTime();
        
                // Event sedang berlangsung
                const isEventOngoing = eventCreatedAt.getTime() <= wibNow.getTime() && eventEndTime.getTime() > wibNow.getTime();
        
                // Menampilkan event yang sesuai tanggal dan sedang berlangsung/akan datang
                return isEventInFuture || isEventOngoing;
            });
        
            // Urutkan berdasarkan startTime dan endTime
            const parseEventTime = (eventDate, timeString) => {
                const [hours, minutes] = timeString.split(':').map(Number);
                const eventDateTime = new Date(eventDate);
                eventDateTime.setHours(hours, minutes, 0, 0);
                return eventDateTime;
            };
            
            filteredEvents.sort((a, b) => {
                const aStart = parseEventTime(a.date, a.startTime);
                const bStart = parseEventTime(b.date, b.startTime);
            
                // Urutkan berdasarkan startTime lebih dahulu
                if (aStart.getTime() !== bStart.getTime()) {
                    return aStart - bStart;
                }
            
                // Jika startTime sama, urutkan berdasarkan endTime
                const aEnd = parseEventTime(a.date, a.endTime);
                const bEnd = parseEventTime(b.date, b.endTime);
            
                return aEnd - bEnd;
            });
        
            return filteredEvents;
        };

        // Mengambil data schedule berdasarkan churchId dari Firestore
        const eventsRef = doc(db, 'events', churchId);
        const unsubscribeSchedule = onSnapshot(eventsRef, (eventsDocSnap) => {
            if (eventsDocSnap.exists()) {
                const events = eventsDocSnap.data().event_list || [];
                setEventData(filterEventsByEndTime(events)); // Filter sebelum ditampilkan ke state
            } else {
                setEventData([]);
            }
        }, (error) => {
            console.error("Error fetching events:", error);
        });

        // Mengambil data gambar dari API
        // fetchImages();

        // Interval untuk menyaring ulang acara setiap menit
        const eventFilterInterval = setInterval(() => {
            setEventData((prevData) => filterEventsByEndTime(prevData));
        }, 60000); // Jalankan setiap 60 detik

        return () => {
            unsubscribeSchedule();
            unsubscribeFlyers();
            unsubscribeLoopings();
            clearInterval(eventFilterInterval);
        }; // Bersihkan interval saat komponen di-unmount
    }, [churchId]);

    useEffect(() => {
        // Interval untuk mengganti gambar dan jadwal acara
        const imageInterval = setInterval(() => {
            if (images.length > 0) {
                setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
            }
        }, 10000); // 10 detik pergantian gambar

        const loopingImageInterval = setInterval(() => {
            if (loopingImages.length > 0) {
                setLoopingCurrentImageIndex((prevIndex) => (prevIndex + 1) % loopingImages.length);
            }
        }, 10000); // 10 detik pergantian gambar

        {/* Untuk pergantian gambar menggunakan effect blur */}
        // const imageInterval = setInterval(() => {
        //     if (images.length > 0) {
        //         setIsImageTransitioning(true);
        //         setTimeout(() => {
        //             setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
        //             setIsImageTransitioning(false);
        //         }, 500); // Efek blur selama 0.5 detik
        //     }
        // }, 10000); // 10 detik pergantian gambar

        // const loopingImageInterval = setInterval(() => {
        //     if (loopingImages.length > 0) {
        //         setIsImageTransitioning(true);
        //         setTimeout(() => {
        //             setLoopingCurrentImageIndex((prevIndex) => (prevIndex + 1) % loopingImages.length);
        //             setIsImageTransitioning(false);
        //         }, 500); // Efek blur selama 0.5 detik
        //     }
        // }, 10000); // 10 detik pergantian gambar
    
        // Interval untuk mengganti event
        const eventInterval = setInterval(() => {
            if (eventData.length > 0) {
                setIsEventTransitioning(true);
                setTimeout(() => {
                    setCurrentEventIndex((prevIndex) => {
                        const nextIndex = prevIndex + 1;
                        return nextIndex * 3 >= eventData.length ? 0 : nextIndex;
                    });
                    setIsEventTransitioning(false);
                }, 500); // Efek blur selama 0.5 detik
            }
        }, 8000); // 8 detik pergantian event
    
        // Cleanup interval saat komponen unmount atau dependensi berubah
        return () => {
            clearInterval(imageInterval);
            clearInterval(loopingImageInterval);
            clearInterval(eventInterval);
        };
    }, [images.length, loopingImages.length, eventData]);

    // Fungsi untuk fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            containerRef.current?.classList.add('fullscreen'); // Tambahkan class saat fullscreen
        } else {
            document.exitFullscreen?.();
            containerRef.current?.classList.remove('fullscreen'); // Hapus class saat keluar fullscreen
        }
    };

    // Untuk merender jadwal acara
    const renderEvent = (eventSlice) => {
        return eventSlice.map((event, index) => (
            <div key={index} className={`event ${isEventTransitioning ? 'blur' : ''}`}>
                <h4 className='title'>{event.title.toUpperCase()}</h4>
                <div className="event-details">
                    <p className='location'>{event.location.toUpperCase()}</p>
                    <p className="floor">{event.floor.toUpperCase()}<sup>{event.textfloor || "FL"}</sup></p>
                    <p className="time">{event.startTime} - {event.endTime} <span className='wib'>WIB</span></p>
                </div>

                {/* Menampilkan divider dan hanya muncul jika bukan data terakhir */}
                {index < eventSlice.length - 1 && <div className='divider-landing'></div>}
            </div>
        ));
    };

    const hasEvents = eventData.length > 0;
    const totalSlides = hasEvents ? Math.ceil(eventData.length / 3) : 0;

    useEffect(() => {
        setShowLoopingImages(eventData.length === 0 || images.length === 0);
    }, [eventData, images]);

    // Refresh halaman setiap 30 menit untuk memastikan sinkronisasi data
    // useEffect(() => {
    //     const refreshTimer = setTimeout(() => {
    //         window.location.reload();
    //     }, 30 * 60 * 1000); // 30 menit
    
    //     return () => clearTimeout(refreshTimer);
    // }, []);

    return (
        <div ref={containerRef} onDoubleClick={toggleFullscreen} className="landing-container">
            {/* Jika tidak ada event, tampilkan looping images */}
            {eventData.length === 0 && loopingImages.length > 0 ? (
                <img src={loopingImages[loopingCurrentImageIndex]} className="full-screen-looping" alt={`loopings-${loopingCurrentImageIndex + 1}`} />
            ) : (
                <>
                    {images.length === 0 && loopingImages.length > 0 && ( <img src={loopingImages[loopingCurrentImageIndex]} className="full-screen-looping" alt={`loopings-${loopingCurrentImageIndex + 1}`} /> )}
                    
                    {/* Bagian Kiri Kontainer */}
                    <div className="left-container">
                        <div className="header-landing">
                            <h2 className='title'>JADWAL HARI INI</h2>
                            <h3 className='time'>{getFormattedDate().toUpperCase()}</h3>
                        </div>
                        {hasEvents && (
                            <>
                                <div className={`events-container ${isEventTransitioning ? 'transitioning' : 'non-transitioning'}`}>
                                    {renderEvent(eventData.slice(currentEventIndex * 3, currentEventIndex * 3 + 3))}
                                </div>
                                <div className={`slide-container ${isEventTransitioning ? 'transitioning' : 'non-transitioning'}`}>
                                    <p className='count-slide'>{currentEventIndex + 1} dari {totalSlides}</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bagian Kanan Kontainer */}
                    <div className="right-container">
                        {images.length > 0 && ( <img src={images[currentImageIndex]} alt={`flyers-${currentImageIndex + 1}`} className={isImageTransitioning ? 'transitioning' : 'non-transitioning'}/> )}
                    </div>
                </>
            )}
        </div>
    )
}

export default LandingPage