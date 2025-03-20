import React, { useState, useEffect, useMemo, useContext } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CButton, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CForm, CFormInput, CFormText, CToast, CToastHeader, CToastBody, CToaster, CSpinner } from '@coreui/react';
import { cilPencil, cilTrash, cilBan, cilPlus, cilPaperPlane } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { auth, db } from "../../api/configuration";
import { doc, getDoc, setDoc, arrayUnion, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useParams } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import { v4 as uuidv4 } from 'uuid';
import translations from "../../language/translations";
import { LanguageContext } from "../../context/LanguageContext"
import { API_BASE_URL } from "../../api/base";

const ScheduleEventList = () => {
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', location: '', floor: '', date: '', startTime: '', endTime: '' });
  const [editEvent, setEditEvent] = useState(null);
  const [errors, setErrors] = useState({ title: '', location: '', floor: '', date: '', startTime: '', endTime: '' });
  const [toastMessage, setToastMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading');
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { churchSlug } = useParams(); // Ambil churchSlug dari URL
  const [churchId, setChurchId] = useState(null); // Ambil data gereja dari API
  const { language } = useContext(LanguageContext);

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
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        isMounted && setLoading(false);
      }
    });

    // Bersihkan listener ketika komponen onAuthStateChanged tidak lagi digunakan
    return () => { isMounted = false; unsubscribeAuth() };
  }, [navigate]);

  // Untuk membuat tulisan loading bergerak
  useEffect(() => {
    let dotCount = 0;
    const interval = setInterval(() => {
      dotCount = (dotCount + 1) % 4; // Mengulang dari 0 ke 3
      setLoadingText(`Loading${'.'.repeat(dotCount)}`);
    }, 500); // Update setiap 500ms

    return () => clearInterval(interval); // Membersihkan interval saat komponen unmount
  }, []);

  // Fetch data dari Firestore dan real-time
  useEffect(() => {
    // Pastikan churchId ada sebelum mengambil data
    if (!churchId) return;
  
    const churchRef = doc(db, "events", churchId);
  
    const unsubscribe = onSnapshot(churchRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();

        // Gunakan event_list jika ada
        setEvents(data.event_list || []);
      } else {
        // Jika tidak ada event, set array kosong
        setEvents([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      setLoading(false);
    });
  
    return () => unsubscribe(); // Bersihkan listener ketika komponen tidak lagi digunakan
  }, [churchId]);

  const validateFields = () => {
    let fieldErrors = {};
    if (!newEvent.title) fieldErrors.title = translations[language].title_required;
    if (!newEvent.location) fieldErrors.location = translations[language].location_required;
    if (!newEvent.floor) fieldErrors.floor = translations[language].floor_required;
    if (!newEvent.date) fieldErrors.date = translations[language].date_required;
    if (!newEvent.startTime) fieldErrors.startTime = translations[language].start_time_required;
    if (!newEvent.endTime) fieldErrors.endTime = translations[language].end_time_required;
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  // Untuk memformat slug menjadi huruf kapital
  const formattedChurchSlug = decodeURIComponent(churchSlug).replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

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

  // Fungsi untuk menambahkan event
  const handleAddEvent = async () => {
    if (!churchId) {
      showToast({ type: 'error', message: 'Church ID not found' });
      return;
    }
  
    if (!validateFields()) return;

    setLoading(true); // Aktifkan loading

    setTimeout(async () => {
      try {
        // Mendapatkan timestamp WIB
        const currentDate = new Date();
        const offset = 7 * 60; // WIB = UTC+7, dalam menit
        const localDate = new Date(currentDate.getTime() + offset * 60 * 1000);
        const currentTimestampWIB = localDate.toISOString().replace('T', ' ').split('.')[0]; // Format "YYYY-MM-DD HH:mm:ss"
    
        // Generate unique ID untuk event
        const eventId = uuidv4();
        
        const newEventWithTimestamp = { id: eventId, ...newEvent, created_at: currentTimestampWIB };

        // Menyimpan data ke database events
        const churchRef = doc(db, 'events', churchId);

        // Simpan event berdasarkan church_id
        await setDoc(churchRef, { event_list: arrayUnion(newEventWithTimestamp) }, { merge: true });
        
        setEvents([...events, newEventWithTimestamp]); // Menambahkan event ke state lokal
        setNewEvent({ title: '', location: '', floor: '', date: '', startTime: '', endTime: '' }); // Setel ulang Event baru setelah sukses
        setErrors({ title: '', location: '', floor: '', date: '', startTime: '', endTime: '' }); // Atur ulang kesalahan
        setShowAddModal(false);
        showToast({ type: 'success', message: translations[language].success_added_schedule });
      } catch (error) {
        showToast({ type: 'error', message: `${translations[language].error_added_schedule} ${error.message}` });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Fungsi untuk mengedit event
  const handleEditEvent = (event) => {
    setEditEvent(event);
    setNewEvent({ ...event }); // Set state newEvent dengan data event yang akan diedit
    setShowEditModal(true);
  };

  // Fungsi untuk memperbarui event
  const handleUpdateEvent = async () => {
    if (!validateFields()) return;

    if (!editEvent || !churchId) {
      showToast({ type: "error", message: "Event or Church ID not found" });
      return;
    }

    setLoading(true); // Aktifkan loading

    setTimeout(async () => {
      try {
        const churchRef = doc(db, "events", churchId);
        const docSnapshot = await getDoc(churchRef);

        if (!docSnapshot.exists()) {
          throw new Error("Church events document not found");
        }

        const data = docSnapshot.data();
        const updatedEvents = (data.event_list || []).map((event) =>
          event.id === editEvent.id ? { ...event, ...newEvent } : event
        );

        // Update event_list di Firestore
        await updateDoc(churchRef, { event_list: updatedEvents });

        // Perbarui state dengan event baru
        setEvents(updatedEvents); // Memperbarui event di state lokal
        setNewEvent({ title: "", location: "", floor: "", date: "", startTime: "", endTime: "" }); // Setel ulang Event baru setelah sukses
        setEditEvent(null); // Reset editEvent setelah selesai edit
        setErrors({ title: "", location: "", floor: "", date: "", startTime: "", endTime: "" }); // Atur ulang kesalahan
        setShowEditModal(false);
        showToast({ type: "success", message: translations[language].success_update_schedule });
      } catch (error) {
        showToast({ type: "error", message: `${translations[language].error_update_schedule} ${error.message}` });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Fungsi untuk menampilkan modal konfirmasi penghapusan
  const confirmDeleteEvent = (id) => {
    setDeleteEventId(id); // Set ID event yang akan dihapus
    setShowConfirmDeleteModal(true); // Tampilkan modal konfirmasi
  };

  // Fungsi untuk menghapus event
  const handleDeleteEvent = async () => {
    if (!deleteEventId || !churchId) {
      showToast({ type: "error", message: "Event or Church ID not found" });
      return;
    }

    setLoading(true); // Aktifkan loading

    setTimeout(async () => {
      try {
        const churchRef = doc(db, "events", churchId);
        const docSnapshot = await getDoc(churchRef);

        if (!docSnapshot.exists()) {
          throw new Error("Church events document not found");
        }

        const data = docSnapshot.data();
        const updatedEvents = (data.event_list || []).filter(event => event.id !== deleteEventId);

        // Update event_list di Firestore
        await updateDoc(churchRef, { event_list: updatedEvents });

        // Perbarui state dengan event yang tersisa
        setEvents(updatedEvents);
        setShowConfirmDeleteModal(false); // Tutup modal konfirmasi
        showToast({ type: "success", message: translations[language].success_delete_schedule });
      } catch (error) {
        showToast({ type: "error", message: `${translations[language].error_delete_schedule} ${error.message}` });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Fungsi untuk menampilkan toast
  const renderToast = () => {
    if (!toastMessage) return null;

    return (
      <CToast autohide={false} visible={true} color={toastMessage.type === 'success' ? 'success' : 'danger'}>
        <CToastHeader closeButton>
          <strong className="me-auto">{translations[language].today_event}</strong>
          <small>{translations[language].just_now}</small>
        </CToastHeader>
        <CToastBody>{toastMessage.message}</CToastBody>
      </CToast>
    );
  };

  // Menampilkan toast dengan waktu otomatis
  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000); // 3000ms (3 detik)
  };

  // Untuk melakukan sorted asc atau desc
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  const filteredEvent = useMemo(() => {
    if (!Array.isArray(events) || events.length === 0) return [];
  
    return events.filter(event =>
      Object.values(event).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [events, searchTerm]);

  const sortedEvent = useMemo(() => {
    if (!Array.isArray(filteredEvent) || filteredEvent.length === 0) return [];
    return [...filteredEvent].sort((a, b) => {
      if (!sortConfig.key) return 0;
      const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
      const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
  
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEvent, sortConfig]);

  // Untuk membuat paginasi
  const pageCount = Math.ceil(sortedEvent.length / itemsPerPage);
  const handlePageClick = ({ selected }) => setCurrentPage(selected);
    
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <CCol xs={12}>
      {loading && (
        <div className="loading-overlay d-flex flex-column justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', zIndex: 1050 }}>
          <CSpinner color="primary" className="spinner" />
          <p className="redirect-message mt-3">{loadingText}</p>
        </div>
      )}
      <CCard className="mb-4">
        <CCardHeader>
          <strong>{translations[language].event} - {formattedChurchSlug}</strong>
          <div className='container-filter'>
            <div className='length-menu'>
              <select className="form-select w-auto" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
                {[10, 25, 50, 100].map(size => ( <option key={size} value={size}>{size}</option> ))}
              </select>
              <span className='entries-page'>{translations[language].entries_page}</span>
            </div>
            <div className='fields-search'>
              <label className='label-search'>{translations[language].search}</label>
              <input type="text" className="form-control" placeholder={translations[language].placeholder_search} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
            </div>
          </div>
        </CCardHeader>
        <CCardBody>
          <p className="text-body-secondary small">
            {translations[language].info_event1} <code>{translations[language].info_event2}</code> {translations[language].info_event3}
          </p>
          <CButton color="primary" onClick={() => { setNewEvent({ title: '', location: '', floor: '', date: '', startTime: '', endTime: '' }); setShowAddModal(true) }}>
            {translations[language].add_event}
          </CButton>
          <div className="table-responsive mt-3">
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('id')}>No {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('title')}>{translations[language].title} {sortConfig.key === 'title' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('location')}>{translations[language].location} {sortConfig.key === 'location' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('floor')}>{translations[language].floor} {sortConfig.key === 'floor' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('date')}>{translations[language].date} {sortConfig.key === 'date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('startTime')}>{translations[language].time} {sortConfig.key === 'startTime' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col">{translations[language].actions}</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {Array.isArray(sortedEvent) && sortedEvent.length > 0 ? (
                  sortedEvent.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((event, index) => (
                    <CTableRow key={event.id}>
                      <CTableDataCell>{index + 1}</CTableDataCell>
                      <CTableDataCell>{event.title}</CTableDataCell>
                      <CTableDataCell>{event.location}</CTableDataCell>
                      <CTableDataCell>{event.floor}</CTableDataCell>
                      {/* <CTableDataCell>{event.date}</CTableDataCell> */}
                      <CTableDataCell>
                        {new Intl.DateTimeFormat('id-ID', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        }).format(new Date(event.date))}
                      </CTableDataCell>
                      <CTableDataCell>{event.startTime && event.endTime ? `${event.startTime} - ${event.endTime} WIB` : 'N/A'}</CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex">
                          <CButton
                            color="warning"
                            onClick={() => handleEditEvent(event)}
                            className="mr-2"
                          >
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton
                            color="danger button-delete"
                            onClick={() => confirmDeleteEvent(event.id)} // Tampilkan modal konfirmasi
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        </div>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                ) : (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className="text-center">
                      {translations[language].no_data}
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </div>

          {/* Untuk Memunculkan jumlah data dan pagination */}
          <div className="d-flex justify-content-between align-items-center mt-3">
            {/* Menampilkan jumlah data */}
            <span className="text-muted">
              {translations?.[language]?.showing} {Math.min(currentPage * itemsPerPage + 1, events?.length ?? 0)} {translations?.[language]?.to} {Math.min((currentPage + 1) * itemsPerPage, events?.length ?? 0)} {translations?.[language]?.of} {events?.length ?? 0} {translations?.[language]?.entries}
            </span>
            
            {/* Pagination */}
            <ReactPaginate
              previousLabel={translations[language].previous}
              nextLabel={translations[language].next}
              breakLabel={'...'}
              pageCount={pageCount}
              marginPagesDisplayed={2}
              pageRangeDisplayed={3}
              onPageChange={handlePageClick}
              containerClassName={'pagination justify-content-end mb-0'}
              activeClassName={'active'}
              previousClassName={'page-item'}
              nextClassName={'page-item'}
              pageClassName={'page-item'}
              previousLinkClassName={'page-link'}
              nextLinkClassName={'page-link'}
              pageLinkClassName={'page-link'}
              breakClassName={'page-item'}
              breakLinkClassName={'page-link'}
            />
          </div>
          
        </CCardBody>
      </CCard>

      {/* Modal untuk Konfirmasi Penghapusan */}
      <CModal visible={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].confirm_deletion}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {translations[language].deletion_reminder_schedule}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowConfirmDeleteModal(false)}>
            <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
          </CButton>
          <CButton color="danger button-confirmation" onClick={handleDeleteEvent} disabled={loading}>
            {loading ? (<CSpinner size="sm" />) : (<><CIcon icon={cilTrash} className="me-1" />{translations[language].delete}</>)}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal untuk Menambah Acara */}
      <CModal visible={showAddModal} onClose={() => setShowAddModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].add_event}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              type="text"
              id="title"
              label={translations[language].title}
              value={newEvent.title}
              placeholder={translations[language].enter_event_title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              invalid={!!errors.title}
            />
            {errors.title && <CFormText className='form-alert'>{errors.title}</CFormText>}

            <CFormInput
              type="text"
              id="location"
              label={translations[language].location}
              value={newEvent.location}
              placeholder={translations[language].enter_event_location}
              onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              invalid={!!errors.location}
            />
            {errors.location && <CFormText className='form-alert'>{errors.location}</CFormText>}

            <CFormInput
              id="floor"
              label={translations[language].floor}
              type="text"
              placeholder={translations[language].enter_event_floor}
              value={newEvent.floor}
              onChange={(e) => setNewEvent({ ...newEvent, floor: e.target.value })}
              invalid={!!errors.floor}
            />
            {errors.floor && <CFormText className='form-alert'>{errors.floor}</CFormText>}

            <CFormInput
              id="date"
              label={translations[language].date}
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              invalid={!!errors.date}
            />
            {errors.date && <CFormText className='form-alert'>{errors.date}</CFormText>}

            <CFormInput
              type="time"
              id="startTime"
              label={translations[language].start_time}
              value={newEvent.startTime}
              onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
              invalid={!!errors.startTime}
            />
            {errors.startTime && <CFormText className='form-alert'>{errors.startTime}</CFormText>}

            <CFormInput
              type="time"
              id="endTime"
              label={translations[language].end_time}
              value={newEvent.endTime}
              onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
              invalid={!!errors.endTime}
            />
            {errors.endTime && <CFormText className='form-alert'>{errors.endTime}</CFormText>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowAddModal(false)}>
            <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
          </CButton>
          <CButton color="primary" onClick={handleAddEvent} disabled={loading}>
            {loading ? (<CSpinner size="sm" />) : (<><CIcon icon={cilPlus} className="me-1" />{translations[language].add}</>)}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal untuk Mengedit Acara */}
      <CModal visible={showEditModal} onClose={() => setShowEditModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].edit_event}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <CFormInput
              type="text"
              id="title"
              label={translations[language].title}
              value={newEvent.title}
              placeholder={translations[language].enter_event_title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              invalid={!!errors.title}
            />
            {errors.title && <CFormText className='form-alert'>{errors.title}</CFormText>}

            <CFormInput
              type="text"
              id="location"
              label={translations[language].location}
              value={newEvent.location}
              placeholder={translations[language].enter_event_location}
              onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              invalid={!!errors.location}
            />
            {errors.location && <CFormText className='form-alert'>{errors.location}</CFormText>}

            <CFormInput
              id="floor"
              label={translations[language].floor}
              type="text"
              placeholder={translations[language].enter_event_floor}
              value={newEvent.floor}
              onChange={(e) => setNewEvent({ ...newEvent, floor: e.target.value })}
              invalid={!!errors.floor}
            />
            {errors.floor && <CFormText className='form-alert'>{errors.floor}</CFormText>}

            <CFormInput
              id="date"
              label={translations[language].date}
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              invalid={!!errors.date}
            />
            {errors.date && <CFormText className='form-alert'>{errors.date}</CFormText>}

            <CFormInput
              type="time"
              id="startTime"
              label={translations[language].start_time}
              value={newEvent.startTime}
              onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
              invalid={!!errors.startTime}
            />
            {errors.startTime && <CFormText className='form-alert'>{errors.startTime}</CFormText>}

            <CFormInput
              type="time"
              id="endTime"
              label={translations[language].end_time}
              value={newEvent.endTime}
              onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
              invalid={!!errors.endTime}
            />
            {errors.endTime && <CFormText className='form-alert'>{errors.endTime}</CFormText>}
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowEditModal(false)}>
            <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
          </CButton>
          <CButton color="primary" onClick={handleUpdateEvent} disabled={loading}>
            {loading ? (<CSpinner size="sm" />) : (<><CIcon icon={cilPaperPlane} className="me-1" />{translations[language].update}</>)}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Toaster untuk Notifikasi */}
      <CToaster placement="top-end">
        {renderToast()}
      </CToaster>
    </CCol>
  )
}

export default ScheduleEventList