import React, { useState, useEffect, useMemo, useContext } from 'react';
import { CCard, CCardBody, CCardHeader, CCol, CTable, CTableHead, CTableRow, CTableHeaderCell, CTableBody, CTableDataCell, CButton, CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CForm, CFormInput, CFormText, CFormSelect, CToast, CToastHeader, CToastBody, CToaster, CSpinner } from '@coreui/react';
import { cilPencil, cilTrash, cilBan, cilPaperPlane, cilUserPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { db, auth } from "../../api/configuration";
import { doc, collection, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleDot } from '@fortawesome/free-regular-svg-icons';
import chroma from "chroma-js";
import classNames from "classnames";
import translations from "../../language/translations";
import { LanguageContext } from "../../context/LanguageContext"
import { API_BASE_URL } from "../../api/base";

const AccessManagement = () => {
  const [toastMessage, setToastMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Loading');
  const [currentPage, setCurrentPage] = useState(0);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [accessToDelete, setAccessToDelete] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [churchList, setChurchList] = useState([]);
  const navigate = useNavigate();
  const [accessList, setAccessList] = useState([]);
  const [newAccess, setNewAccess] = useState({ church_id: '', username: '', email: '', department: '', role: 'User', accountstatus: 'Active', systemstatus: 'Offline' });
  const [editAccess, setEditAccess] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
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
    fetchAccessList();
  }, []);

  // Ambil akses dari Firestore
  const fetchAccessList = async () => {
    try {
      const accessCollection = collection(db, 'users');
      const accessSnapshot = await getDocs(accessCollection);
      const accessData = accessSnapshot.docs.map(doc => {
        let data = doc.data();
  
        // Format dari tanggal sistem ke tanggal indonesia
        const formattedDate = data.createdAt
          ? new Date(
              data.createdAt.seconds
                ? data.createdAt.seconds * 1000 // Jika format Timestamp Firestore
                : data.createdAt // Jika sudah berupa date string
            ).toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })
          : '-';
  
        return {
          id: doc.id,
          church_id: data.church_id,
          username: data.username,
          email: data.email,
          department: data.department,
          role: data.role,
          accountstatus: data.accountstatus,
          systemstatus: data.systemstatus,
          createdAt: formattedDate,
        };
      });
  
      setAccessList(accessData);
    } catch (error) {
      console.error("Error fetching access list:", error);
    }
  };

  // Validasi inputan form
  const validateFields = async () => {
    let fieldErrors = {};
    if (!newAccess.church_id) fieldErrors.church_id = translations[language].local_church_required;
    if (!newAccess.username) fieldErrors.username = translations[language].username_required;
    if (!newAccess.email) {
      fieldErrors.email = translations[language].email_required;
    } else if (!newAccess.email.endsWith("@gmail.com") && !newAccess.email.endsWith("@gms.church")) {
      fieldErrors.email = translations[language].email_validation;
    } else {
      // Cek apakah email sudah ada di Firestore
      const querySnapshot = await getDocs(
        query(collection(db, "users"), where("email", "==", newAccess.email))
      );
  
      if (!querySnapshot.empty) {
        fieldErrors.email = translations[language].email_already;
      }
    }
    if (!newAccess.department) fieldErrors.department = translations[language].department_required;
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  };

  // Tambah akses baru
  const handleAddAccess = async () => {
    const isValid = await validateFields();
    if (!isValid) return;
  
    setLoading(true); // Aktifkan loading
    
    setTimeout(async () => {
      const user = auth.currentUser;
      if (!user) {
        showToast({ type: 'error', message: translations[language].user_not_auth });
        setLoading(false);
        return;
      }
    
      const newData = {
        church_id: newAccess.church_id,
        username: newAccess.username,
        email: newAccess.email,
        department: newAccess.department,
        role: "User",
        accountstatus: newAccess.accountstatus,
        systemstatus: newAccess.systemstatus,
        createdAt: new Date().toISOString(),
      };
    
      try {
        // Tambahkan user dengan ID acak
        await addDoc(collection(db, "users"), newData);
        fetchAccessList(); // Perbarui data
        resetForm(); // Atur ulang formulir
        setModalOpen(false); // Tutup modal
        showToast({ type: "success", message: translations[language].success_added });
      } catch (error) {
        showToast({ type: "error", message: `${translations[language].error_added} ${error.message}` });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Edit akses
  const handleEditAccess = (access) => {
    setEditAccess(access);
    setNewAccess({
      church_id: access.church_id,
      username: access.username,
      email: access.email,
      department: access.department,
      role: access.role,
      accountstatus: access.accountstatus,
      systemstatus: access.systemstatus
    });
    setModalOpen(true);
  };

  // Update akses
  const handleUpdateAccess = async () => {
    if (!validateFields()) return;

    setLoading(true); // Aktifkan loading
    
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, 'users', editAccess.id), {
          church_id: newAccess.church_id,
          username: newAccess.username,
          accountstatus: newAccess.accountstatus,
          department: newAccess.department
        });
        fetchAccessList();
        resetForm();
        setModalOpen(false);
        showToast({ type: 'success', message: translations[language].success_update });
      } catch (error) {
        showToast({ type: 'error', message: `${translations[language].error_update} ${error.message}` });
      } finally {
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Hapus akses
  const confirmDeleteAccess = (id) => {
    setAccessToDelete(id);
    setShowConfirmDeleteModal(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!accessToDelete) return;
    
    setLoading(true); // Aktifkan loading
    
    setTimeout(async () => {
      try {
        await deleteDoc(doc(db, 'users', accessToDelete));
        // Refresh daftar akses
        setAccessList(accessList.filter(access => access.id !== accessToDelete));
        showToast({ type: 'success', message: translations[language].success_delete });
      } catch (error) {
        showToast({ type: 'error', message: `${translations[language].error_delete} ${error.message}` });
      } finally {
        setShowConfirmDeleteModal(false);
        setAccessToDelete(null);
        setLoading(false); // Matikan loading setelah proses selesai
      }
    }, 500); // Delay 0,5 detik sebelum menjalankan operasi
  };

  // Reset form
  const resetForm = () => {
    setNewAccess({ church_id: '', username: '', email: '', department: '', role: 'User', accountstatus: 'Active', systemstatus: 'Offline' });
    setEditAccess(null);
    setErrors({});
  };

  // Untuk mengambil data gms
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

  // Untuk mengubah church_id menjadi name
  const getChurchName = (church_id) => {
    // Pastikan church_id selalu dalam bentuk array
    const ids = Array.isArray(church_id) ? church_id : [church_id];
  
    if (!ids || ids.length === 0) return '-';
  
    return ids
      .map((id) => {
        const church = churchList.find((c) => c.church_id === id);
        return church ? church.name : '-';
      })
      .join(', ');
  };

  // Pilihan opsi local church
  const churchOptions = useMemo(() => 
    (churchList || []).map(church => ({
      value: church.church_id,
      label: church.name
    })), 
    [churchList]
  );

  // Ubah pilihan opsi local church
  const handleChangeChurch = (selectedOptions) => {
    setNewAccess({ ...newAccess, church_id: selectedOptions?.map(option => option.value) || [] });
  };

  // Pilihan opsi department dengan warna yang diinginkan
  const departmentOptions = [
    { value: "ICT", label: "ICT", color: "rgb(255, 139, 0)" },
    { value: "Comm", label: "Comm", color: "rgb(0, 184, 217)" },
    { value: "GA", label: "GA", color: "rgb(82, 67, 170)" }
  ];

  // Fungsi untuk membuat dot warna
  const dot = (color = "transparent") => ({
    alignItems: "center",
    display: "flex",
    ":before": {
      backgroundColor: color,
      borderRadius: 10,
      content: '" "',
      display: "block",
      marginRight: 8,
      height: 10,
      width: 10,
    },
  });

  // Styling untuk dropdown
  const customStyles = {
    control: (styles) => ({
      ...styles,
      backgroundColor: "white",
      borderColor: "#ccc",
      "&:hover": { borderColor: "#888" }
    }),
    option: (styles, { data, isDisabled, isFocused, isSelected }) => {
      const color = chroma(data.color);
      return {
        ...styles,
        backgroundColor: isDisabled
          ? undefined
          : isSelected
          ? data.color
          : isFocused
          ? color.alpha(0).css()
          : undefined,
        color: isSelected ? "white" : data.color, // Warna teks mengikuti warna utama
        cursor: isDisabled ? "not-allowed" : "pointer",
        transition: "background-color 0.2s ease-in-out",
  
        ":hover": {
          backgroundColor: !isSelected ? color.alpha(0.30).css() : data.color,
        },
        ":active": {
          backgroundColor: data.color,
        },
      };
    },
    input: (styles) => ({ ...styles, ...dot() }),
    placeholder: (styles) => ({ ...styles, ...dot("#ccc") }),
    singleValue: (styles, { data }) => ({ ...styles, ...dot(data.color) }),
  };

  // Ubah pilihan opsi department
  const handleChangeDepartment = (selectedOption) => {
    setNewAccess((prev) => ({
      ...prev,
      
      // Simpan satu nilai, bukan array
      department: selectedOption ? selectedOption.value : ""
    }));
  };

  // Untuk melakukan sorted asc atau desc
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  useEffect(() => {
    const usersCollectionRef = collection(db, "users");
  
    const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
      const users = snapshot.docs.map((doc) => {
        const data = doc.data();
  
        // Konversi Firestore Timestamp ke JavaScript Date
        const createdAt = data.createdAt?.toDate 
          ? data.createdAt.toDate() 
          : new Date(data.createdAt || Date.now()); 
  
        // Format tanggal menjadi "25 Februari 2025"
        const formattedDate = createdAt.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
  
        return {
          id: doc.id,
          church_id: data.church_id,
          username: data.username,
          email: data.email,
          department: data.department,
          role: data.role,
          accountstatus: data.accountstatus,
          systemstatus: data.systemstatus,
          createdAt: formattedDate, // Simpan hasil format tanggal
        };
      });
  
      setAccessList(users);
    });
  
    return () => unsubscribe(); // Bersihkan data saat komponen dilepas
  }, []);

  const filteredAccessList = useMemo(() => {
    if (!Array.isArray(accessList) || accessList.length === 0) return [];
  
    return accessList.filter(access =>
      Object.values(access).some(value =>
        value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [accessList, searchTerm]);
  
  const sortedAccessList = useMemo(() => {
    if (!Array.isArray(filteredAccessList) || filteredAccessList.length === 0) return [];
    return [...filteredAccessList].sort((a, b) => {
      if (!sortConfig.key) return 0;
      const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
      const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
  
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredAccessList, sortConfig]);

  // Untuk membuat paginasi
  const pageCount = Math.ceil(sortedAccessList.length / itemsPerPage);
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
          <strong>{translations[language].role}</strong>
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
            {translations[language].info_access1} <code>{translations[language].info_access2}</code> {translations[language].info_access3}
          </p>
          <CButton color="primary" onClick={() => { resetForm(); setModalOpen(true); }}>
            {translations[language].add_access}
          </CButton>
          <div className="table-responsive mt-3">
            <CTable hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('id')}>No {sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" style={{ width: '25vh', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => handleSort('church_id')}>{translations[language].local_church} {sortConfig.key === 'church_id' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('username')}>{translations[language].username} {sortConfig.key === 'username' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('email')}>{translations[language].email} {sortConfig.key === 'email' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('department')}>{translations[language].department} {sortConfig.key === 'department' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('role')}>{translations[language].role} {sortConfig.key === 'role' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('accountstatus')}>Status {sortConfig.key === 'accountstatus' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('systemstatus')}>{translations[language].system} {sortConfig.key === 'systemstatus' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col" onClick={() => handleSort('createdAt')}>{translations[language].join} {sortConfig.key === 'createdAt' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}</CTableHeaderCell>
                  <CTableHeaderCell scope="col">{translations[language].actions}</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {Array.isArray(sortedAccessList) && sortedAccessList.length > 0 ? (
                  sortedAccessList.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage).map((access, index) => (
                    <CTableRow key={access.id}>
                      <CTableDataCell>{index + 1}</CTableDataCell>
                      <CTableDataCell>{getChurchName(access.church_id)}</CTableDataCell>
                      <CTableDataCell>{access.username}</CTableDataCell>
                      <CTableDataCell>{access.email}</CTableDataCell>
                      <CTableDataCell className='colorDepartment' style={{ color: access.department === 'ICT' ? '#ff8b00' : access.department === 'Comm' ? '#00b8d9' : access.department === 'GA' ? '#5243aa' : '#f39c12' }}>{access.department}</CTableDataCell>
                      <CTableDataCell className='colorRole' style={{ color: access.role === 'Admin' ? '#6c61f6' : access.role === 'User' ? '#1db9aa' : '#f39c12' }}>{access.role}</CTableDataCell>
                      <CTableDataCell><FontAwesomeIcon icon={faCircleDot} style={{ color: access.accountstatus === 'Active' ? '#55ce63' : access.accountstatus === 'Inactive' ? '#ffbc34' : '#f62d51' }} />{' '} {access.accountstatus}</CTableDataCell>
                      <CTableDataCell><span className='iconSystem' style={{ backgroundColor: access.systemstatus === 'Online' ? '#55ce63' : '#f62d51' }}></span> {access.systemstatus}</CTableDataCell>
                      <CTableDataCell>{access.createdAt}</CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex">
                          <CButton color="warning" onClick={() => handleEditAccess(access)} className="mr-2">
                            <CIcon icon={cilPencil} />
                          </CButton>
                          <CButton color="danger button-delete" onClick={() => confirmDeleteAccess(access.id)}>
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
              {translations?.[language]?.showing} {Math.min(currentPage * itemsPerPage + 1, accessList?.length ?? 0)} {translations?.[language]?.to} {Math.min((currentPage + 1) * itemsPerPage, accessList?.length ?? 0)} {translations?.[language]?.of} {accessList?.length ?? 0} {translations?.[language]?.entries}
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

      {/* Modal Form Access */}
      <CModal visible={modalOpen} onClose={() => setModalOpen(false)}>
        <CModalHeader>
          <CModalTitle>{editAccess ? translations[language].edit_access : translations[language].add_access}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm>
            <label htmlFor={translations[language].local_church}>{translations[language].local_church}</label>
            <Select
              id={translations[language].local_church}
              isMulti
              options={churchOptions}
              placeholder={translations[language].select_local_church}
              value={churchOptions.filter(option => (newAccess.church_id || []).includes(option.value))}
              onChange={handleChangeChurch}
              classNamePrefix="react-select"
              className={classNames("react-select-container", { "is-invalid": errors.church_id })}
              styles={{ control: (provided) => ({ ...provided, borderColor: errors.church_id ? "#dc3545" : provided.borderColor, "&:hover": { borderColor: errors.church_id ? "#dc3545" : provided.borderColor }})}}/>
            {errors.church_id && ( <div className="invalid-feedback">{errors.church_id}</div> )}

            <CFormInput
              type="text"
              id={translations[language].username}
              label={translations[language].username}
              value={newAccess.username}
              placeholder={translations[language].enter_username}
              onChange={(e) => setNewAccess({ ...newAccess, username: e.target.value })}
              invalid={!!errors.username}
            />
            {errors.username && <CFormText className='form-alert'>{errors.username}</CFormText>}

            <CFormInput
              type="text"
              id={translations[language].email}
              label={translations[language].email}
              value={newAccess.email}
              placeholder={translations[language].enter_email}
              onChange={(e) => setNewAccess({ ...newAccess, email: e.target.value })} disabled={!!editAccess}
              invalid={!!errors.email}
            />
            {errors.email && <CFormText className='form-alert'>{errors.email}</CFormText>}

            <label htmlFor={translations[language].department}>{translations[language].department}</label>
            <Select
              id={translations[language].department}
              options={departmentOptions}
              placeholder={translations[language].select_department}
              value={departmentOptions.find((option) => option.value.toLowerCase() === (newAccess.department || "").toLowerCase()) || null}
              onChange={handleChangeDepartment}
              classNamePrefix="react-select"
              className={classNames("react-select-container", { "is-invalid": errors.department })}
              styles={{ ...customStyles, control: (provided, state) => ({ ...provided, borderColor: errors.department ? "#dc3545" : provided.borderColor, "&:hover": { borderColor: errors.department ? "#dc3545" : provided.borderColor }})}}/>
            {errors.department && ( <div className="invalid-feedback">{errors.department}</div> )}

            <CFormInput
              type="text"
              id={translations[language].role}
              label={translations[language].role}
              value={newAccess.role}
              disabled
            />

            <CFormSelect
              id={translations[language].account_status}
              label={translations[language].account_status}
              value={editAccess ? newAccess.accountstatus : 'Active'}
              onChange={(e) => setNewAccess({ ...newAccess, accountstatus: e.target.value })}
              invalid={!!errors.accountstatus}
              disabled={!editAccess}
            >
              <option value="" disabled>{translations[language].select_user_status}</option>
              <option value="Active">{translations[language].active}</option>
              <option value="Inactive">{translations[language].inactive}</option>
            </CFormSelect>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setModalOpen(false)}><CIcon icon={cilBan} className="me-1" />{translations[language].cancel}</CButton>
          <CButton color="primary" onClick={editAccess ? handleUpdateAccess : handleAddAccess} disabled={loading}>
          {loading ? (<CSpinner size="sm" />) : editAccess ? (<><CIcon icon={cilPaperPlane} className="me-1" />{translations[language].update}</>) : (<><CIcon icon={cilUserPlus} className="me-1" />{translations[language].add}</>)}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Delete Confirmation Modal */}
      <CModal visible={showConfirmDeleteModal} onClose={() => setShowConfirmDeleteModal(false)}>
        <CModalHeader>
          <CModalTitle>{translations[language].confirm_deletion}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {translations[language].deletion_reminder}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setShowConfirmDeleteModal(false)}>
            <CIcon icon={cilBan} className="me-1" />{translations[language].cancel}
          </CButton>
          <CButton color="danger button-confirmation" onClick={handleDeleteConfirmed} disabled={loading}>
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

export default AccessManagement