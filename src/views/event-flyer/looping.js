import React, { useState, useEffect, useMemo, useContext } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CButton, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CForm, CFormText, CToast, CToastHeader, CToastBody, CToaster, CProgress, CSpinner } from '@coreui/react';
import { cilTrash, cilBan, cilCloudUpload, cilCropRotate } from '@coreui/icons';
import CIcon from '@coreui/icons-react';
import { storage, auth, db } from "../../api/configuration";
import { doc, getDoc, setDoc, collection, query, deleteDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import ReactPaginate from 'react-paginate';
// import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import '@fancyapps/ui/dist/fancybox.css';
import { Fancybox } from '@fancyapps/ui';
import imageCompression from 'browser-image-compression';
import { v4 as uuidv4 } from 'uuid';
import translations from "../../language/translations";
import { LanguageContext } from "../../context/LanguageContext"
import { API_BASE_URL } from "../../api/base";

const LoopingFlyer = () => {
  const [loopings, setLoopings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newLooping, setNewLooping] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading');
  const navigate = useNavigate();
  const [errors, setErrors] = useState({ image: '' });
  const [fileDetails, setFileDetails] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const { churchSlug } = useParams(); // Ambil churchSlug dari URL
  const [churchId, setChurchId] = useState(null); // Ambil data gereja dari API
  const { language } = useContext(LanguageContext);

  // Konfirmasi status modal untuk penghapusan
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loopingToDelete, setLoopingToDelete] = useState(null);

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
  
    // Referensi ke subkoleksi flyer_list dalam Firestore
    const loopingsCollectionRef = collection(db, `loopings/${churchId}/looping_list`);
    const q = query(loopingsCollectionRef);
  
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const loopingData = [];
      querySnapshot.forEach((doc) => {

        // Ambil semua data termasuk ID
        loopingData.push({ id: doc.id, ...doc.data() });
      });
  
      // Perbarui state dengan daftar looping
      setLoopings(loopingData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching loopings:", error);
      setLoading(false);
    });
  
    return () => unsubscribe(); // Bersihkan listener ketika komponen tidak lagi digunakan
  }, [churchId]);

  // Validasi bidang formulir
  const validateFields = () => {
    let fieldErrors = {};
    if (!newLooping.filename) fieldErrors.image = translations[language].image_required;
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

  // Menangani penambahan looping
  const handleAddFlyer = async () => {
    if (!churchId) {
      showToast({ type: "error", message: "Church ID not found" });
      return;
    }

    if (newLooping.length === 0) {
      showToast({ type: "error", message: translations[language].no_file_selected });
      return;
    }

    setLoading(true); // Aktifkan loading

    setTimeout(async () => {
      try {
        // Mendapatkan timestamp WIB
        const createdAt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

        // Iterasi setiap looping dalam newLooping
        const uploadPromises = newLooping.map(async (looping) => {
          // Generate unique ID untuk looping
          const loopingsId = uuidv4();

          // Ambil nama file asli tanpa timestamp atau prefix tambahan
          const fileNameOnly = looping.filename.replace(/^\d+_/, "");

          // Referensi koleksi looping_list dalam Firestore
          const loopingRef = doc(db, `loopings/${churchId}/looping_list`, loopingsId);

          // Tambahkan looping baru ke state
          const loopingData = { id: loopingsId, filename: fileNameOnly, image: looping.image, createdAt };

          // Simpan looping sebagai dokumen terpisah dalam subkoleksi
          await setDoc(loopingRef, loopingData);
          return loopingData;
        });

        // Tunggu semua proses unggah selesai
        const uploadedLoopings = await Promise.all(uploadPromises);

        setLoopings([...loopings, ...uploadedLoopings]); // Tambahkan semua looping ke state
        setNewLooping([]); // Setel ulang input setelah sukses
        setFileDetails([]); // Setel ulang detail file
        setShowModal(false);
        showToast({ type: "success", message: translations[language].success_added_flyer });
      } catch (error) {
        showToast({ type: "error", message: translations[language].no_file_selected });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Menangani penghapusan looping
  const handleDeleteFlyer = (id) => {
    setLoopingToDelete(id); // Simpan ID looping yang akan dihapus
    setShowDeleteModal(true); // Tampilkan modal konfirmasi penghapusan
  };

  // Menangani unggahan gambar
  const handleImageUpload = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) {
      showToast({ type: 'error', message: translations[language].no_file_selected });
      return;
    }

    // Validasi tipe file
    const validFileTypes = ['image/jpeg', 'image/png'];
    let uploadedDetails = [];
    let uploadedLoopings = [];

    for (const file of acceptedFiles) {
      if (!validFileTypes.includes(file.type)) {
        showToast({
          type: 'error',
          message: `${translations[language].invalid_file_type} (${file.type}). ${translations[language].format_file}`,
        });
        continue;
      }

      // Kompres gambar
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };
    
      try {
        const compressedFile = await imageCompression(file, options);

        // Buat nama file dan referensi penyimpanan baru
        const filename = `${Date.now()}_${compressedFile.name}`;
        // const storagePath = `announcement-looping/assets/images/${filename}`; // Simpan gambar di "announcement-looping/assets/images/"
        // const storageReference = storageRef(storage, storagePath);

        // const uploadTask = uploadBytesResumable(storageReference, compressedFile);

        // Tampilkan preview gambar sementara
        const reader = new FileReader();
        reader.onload = () => {
          setNewLooping((prevLoopings) => [...prevLoopings, { image: reader.result, filename }]); // Tampilkan gambar lokal sementara
        };
        reader.readAsDataURL(compressedFile);

        // Memantau progress unggahan
        // uploadTask.on(
        //   'state_changed',
        //   (snapshot) => {
        //     const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        //     setUploadProgress(progress);
        //   },
        //   (error) => {
        //     showToast({ type: 'error', message: `Failed to upload image: ${error.message}` });
        //   },
        //   () => {
        //     getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
        //       setNewLooping({ ...newLooping, image: downloadURL, filename }); // Simpan URL unduhan sebagai "image"
        //       setUploadProgress(0); // Setel ulang progress setelah pengunggahan selesai
        //     });
        //   }
        // );

        // Tetapkan detail file (nama dan ukuran) ke state
        uploadedDetails.push({
          name: compressedFile.name,
          size: compressedFile.size <= 1024 * 1024 // Periksa apakah ukuran file kurang dari atau sama dengan 1 MB (1024 KB)
            ? (compressedFile.size / 1024).toFixed(2) + ' KB' // Jika ukuran file ≤ 1 MB, tampilkan dalam KB
            : (compressedFile.size / 1024 / 1024).toFixed(2) + ' MB', // Jika ukuran file > 1 MB, tampilkan dalam MB
        });

      } catch (error) {
        showToast({ type: 'error', message: `Gagal mengkompresi gambar: ${error.message}` });
      }
    }

    setFileDetails((prevDetails) => [...prevDetails, ...uploadedDetails]);
  };

  // Toast notifikasi
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

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000); // Sembunyikan toast setelah 3 detik
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleImageUpload,
    accept: {
      'image/jpeg': [],
      'image/png': [],
    }, // Hanya menerima file .jpg, .jpeg, .png
  });

  // Untuk melakukan sorted asc atau desc
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const filteredLoopings = useMemo(() => {
    if (!Array.isArray(loopings) || loopings.length === 0) return [];
  
    return loopings.filter(looping =>
      Object.values(looping).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [loopings, searchTerm]);

  const sortedLoopings = useMemo(() => {
    if (!Array.isArray(filteredLoopings) || filteredLoopings.length === 0) return [];
    return [...filteredLoopings].sort((a, b) => {
      if (!sortConfig.key) return 0;
      const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
      const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
  
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLoopings, sortConfig]);

  // Untuk membuat paginasi
  const pageCount = Math.ceil(sortedLoopings.length / itemsPerPage);
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
          <strong>{translations[language].looping} - {formattedChurchSlug}</strong>
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
            {translations[language].info_flyer1} <code>{translations[language].info_flyer2}</code> {translations[language].info_flyer3}
          </p>
          <CButton color="primary" onClick={() => setShowModal(true)}>
            {translations[language].add_flyer}
          </CButton>
          <div className="table-responsive mt-3">
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('id')}>ID {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('image')}>{translations[language].image} {sortConfig.key === 'image' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('filename')}>{translations[language].filename} {sortConfig.key === 'filename' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('createdAt')}>{translations[language].date_uploaded} {sortConfig.key === 'createdAt' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col">{translations[language].actions}</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {Array.isArray(sortedLoopings) && sortedLoopings.length > 0 ? (
                  sortedLoopings.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((looping, index) => (
                    <CTableRow key={looping.id}>
                      <CTableDataCell>{index + 1}</CTableDataCell>
                      <CTableDataCell>
                        {looping.image ? (
                          <Link to={looping.image} data-fancybox="gallery" data-caption={looping.filename || 'No Filename'}>
                            <img className='preview-looping' src={looping.image} alt={looping.filename || 'No Filename'} />
                          </Link>
                        ) : (
                          <span>{translations[language].no_image}</span>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>{looping.filename || 'No Filename'}</CTableDataCell>
                      <CTableDataCell>{looping.createdAt} WIB</CTableDataCell>
                      <CTableDataCell>
                        <CButton color="danger" onClick={() => handleDeleteFlyer(looping.id)}>
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))
                ) : (
                  <CTableRow>
                    <CTableDataCell colSpan={5} className="text-center">
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
              {loopings.length > 0 ? `${translations?.[language]?.showing} ${currentPage * itemsPerPage + 1} ${translations?.[language]?.to} ${Math.min((currentPage + 1) * itemsPerPage, loopings.length)} ${translations?.[language]?.of} ${loopings.length} ${translations?.[language]?.entries}`: `${translations?.[language]?.showing_not_data}`}
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

      {/* Modal untuk menambahkan looping */}
      <CModal visible={showModal} onClose={() => setShowModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].add_flyer}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
              <div className='dropzone-container' {...getRootProps()}>
                <input {...getInputProps()} multiple />
                <p>
                  {fileDetails.length > 0 ? fileDetails.map((file, index) => `File ${index + 1}: ${file.name} (${file.size})`).join(', ') : translations[language].drag_and_drop}
                </p>
              </div>
              {errors.image && (
                <CFormText className='dropzone-alert'>
                  {errors.image}
                </CFormText>
              )}
              {(newLooping.length > 0 || uploadProgress > 0) && (
                <div className='preview-container-looping'>
                  {newLooping.map((looping, index) => (
                    <Link key={index} className='link' to={looping.image} data-fancybox="gallery" data-caption={fileDetails[index]?.name || "Preview Image"}>
                      <img className='img' src={looping.image} alt="Preview" />
                      <p className='filename'>{fileDetails[index]?.name}</p>
                    </Link>
                  ))}
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <CProgress className='dropzone-bar' value={uploadProgress}>
                      <span className='dropzone-progress'>
                        {Math.round(uploadProgress)}%
                      </span>
                    </CProgress>
                  )}
                </div>
              )}
          </CForm>
          <span className='size-format'>{translations[language].nb}<br />{translations[language].size_format_2100}</span>
        </CModalBody>
        <CModalFooter>
          {/* Tombol Reset */}
          {newLooping.length > 0 && (
            <CButton color="warning button-reset" onClick={() => { setNewLooping([]); setFileDetails([]); setUploadProgress(0) }}>
              <CIcon icon={cilCropRotate} className="me-1" />{translations[language].reset}
            </CButton>
          )}

          <CButton color="secondary" onClick={() => setShowModal(false)}><CIcon icon={cilBan} className="me-1" />{translations[language].cancel}</CButton>
          <CButton color="primary" onClick={() => { handleAddFlyer(); setFileDetails({ name: '', size: '' }); setNewLooping({ image: '', filename: '', createdAt: '' }); }} disabled={ loading || (uploadProgress > 0 && uploadProgress < 100) } >
            { loading ? (<CSpinner size="sm" />) : uploadProgress > 0 && uploadProgress < 100 ? (translations[language].uploading) : (<><CIcon icon={cilCloudUpload} className="me-1" />{translations[language].upload}</>)}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Modal untuk konfirmasi penghapusan */}
      <CModal visible={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].confirm_deletion}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {translations[language].deletion_reminder_flyer}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowDeleteModal(false)}>
            <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
          </CButton>
          <CButton color="danger button-confirmation" onClick={async () => {
              if (!loopingToDelete || !churchId) return;

              setLoading(true); // Aktifkan loading

              setTimeout(async () => {
                try {
                  // Referensi ke looping di subkoleksi Firestore
                  const loopingRef = doc(db, `loopings/${churchId}/looping_list/${loopingToDelete}`);

                  // Hapus looping dari Firestore
                  await deleteDoc(loopingRef);

                  // Hapus looping dari state lokal
                  setLoopings((prevLoopings) => prevLoopings.filter((looping) => looping.id !== loopingToDelete));

                  showToast({ type: "success", message: translations[language].success_delete_flyer });
                } catch (error) {
                  showToast({ type: "error", message: `${translations[language].error_delete_flyer} ${error.message}` });
                } finally {
                  setLoading(false); // Matikan loading setelah proses selesai
                  setShowDeleteModal(false); // Tutup modal setelah loading selesai
                }
              }, 500); // Delay 0,5 detik sebelum menjalankan operasi
            }} disabled={loading}>
              {loading ? (<CSpinner size="sm" />) : (<><CIcon icon={cilTrash} className="me-1" />{translations[language].delete}</>)}
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

export default LoopingFlyer