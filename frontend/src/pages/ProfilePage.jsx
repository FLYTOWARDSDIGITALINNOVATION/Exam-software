import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin,
  Save, Edit2, ShieldCheck, Loader2,
  BookOpen, Hash, Award
} from 'lucide-react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { getDisplayCourse } from '../utils/courseDisplay';


const ProfilePage = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // State initialization - Keys must match your MongoDB UserSchema exactly
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobile: "",      // Matches Schema
    address: "",     // Matches Schema
    bio: "",         // Will map to 'expertise' in Schema
    studentId: "",   // Matches Schema
    regNo: "",       // Matches Schema
    course: "",      // Matches Schema
    role: ""         // Matches Schema
  });

  const profileCourseText = formData.course ? formData.course : "BSMS";
  const profileStudentTag = formData.studentId ? ` • ${formData.studentId}` : "";

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${process.env.REACT_APP_API_URL || "https://jclsiddhaacademy.in"}/api/user/profile`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');

        const data = await response.json();
        const displayCourse = getDisplayCourse(data);

        // MAPPING: Populate state with data from your MongoDB User model
        setFormData({
          fullName: data.fullName || "Scholar",
          email: data.email || "",
          mobile: data.mobile || "", // Uses 'mobile' from schema
          address: data.address || "",
          bio: data.expertise || data.bio || "",
          studentId: data.studentId || "",
          regNo: data.regNo || "",
          course: displayCourse,
          role: data.role || "student"
        });
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || "https://jclsiddhaacademy.in"}/api/user/update`, {
        method: 'POST', // Matches the backend route we added
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          mobile: formData.mobile,
          address: formData.address,
          expertise: formData.bio // Mapping back to 'expertise' field
        })
      });

      if (response.ok) {
        setIsEditing(false);
        alert("Profile updated successfully!");
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB]">
      <Loader2 className="animate-spin text-teal-600" size={40} />
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 md:p-12 font-sans text-slate-900">

        {/* Header */}
        <div className="max-w-5xl mx-auto mb-6 lg:mb-8 flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-800">My Profile</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto bg-white rounded-3xl lg:rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden"
        >
          <div className="h-32 lg:h-40 bg-gradient-to-r from-teal-700 to-slate-800" />

          <div className="px-6 lg:px-10 pb-8 lg:pb-12">
            {/* Action Bar */}
            <div className="relative -mt-16 lg:-mt-20 mb-8 lg:mb-12 flex flex-col md:flex-row justify-between items-center md:items-end gap-6 text-center md:text-left">
              <div className="w-32 h-32 lg:w-40 lg:h-40 rounded-3xl bg-white p-1.5 lg:p-2 shadow-2xl">
                <div className="w-full h-full rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden">
                  <User size={60} className="text-slate-300 lg:w-20 lg:h-20" />
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-2xl lg:text-3xl font-serif font-bold text-slate-900">{formData.fullName}</h2>
                <p className="text-teal-600 font-medium text-sm lg:text-base">{profileCourseText}{profileStudentTag}</p>
              </div>

              <button
                onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}
                className={`flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3 rounded-2xl font-bold transition-all shadow-lg ${isEditing ? 'bg-orange-600 text-white shadow-orange-200' : 'bg-slate-900 text-white shadow-slate-200'
                  }`}
              >
                {isEditing ? <><Save size={20} /> Save Changes</> : <><Edit2 size={20} /> Edit Profile</>}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-8">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Personal Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ProfileField label="Full Name" name="fullName" value={formData.fullName} isEditing={isEditing} onChange={handleChange} icon={<User size={18} />} />
                    <ProfileField label="Mobile Number" name="mobile" value={formData.mobile} isEditing={isEditing} onChange={handleChange} icon={<Phone size={18} />} />
                    <ProfileField label="Email Address" name="email" value={formData.email} isEditing={false} icon={<Mail size={18} />} />
                    <ProfileField label="Address" name="address" value={formData.address} isEditing={isEditing} onChange={handleChange} icon={<MapPin size={18} />} />
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Professional Bio</h3>
                  {isEditing ? (
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      placeholder="Add your professional bio"
                      className="w-full p-5 rounded-2xl border-2 border-slate-100 outline-none h-32 resize-none transition-all font-medium text-slate-700"
                    />
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 leading-relaxed">
                      {formData.bio ? `"${formData.bio}"` : "—"}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Academic Status</h3>
                <div className="bg-teal-50/50 p-6 rounded-3xl border border-teal-100 space-y-4">
                  <StatusRow icon={<ShieldCheck className="text-teal-600" size={18} />} label="Status" value="Verified" />
                  <StatusRow icon={<Hash className="text-teal-600" size={18} />} label="Reg No" value={formData.regNo} />
                  <StatusRow icon={<BookOpen className="text-teal-600" size={18} />} label="Course" value={formData.course} />
                </div>
                <div className="bg-slate-900 p-8 rounded-3xl text-white relative overflow-hidden group">
                  <p className="text-slate-400 text-[10px] font-bold uppercase mb-2">Level</p>
                  <h4 className="text-xl font-bold mb-4">Elite Scholar</h4>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-teal-400 h-full w-[85%]" />
                  </div>
                  <Award className="absolute -right-2 -bottom-2 text-white/5" size={100} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

const ProfileField = ({ label, name, value, isEditing, onChange, icon }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">{label}</label>
    <div className="relative flex items-center">
      <div className="absolute left-4 text-slate-400">{icon}</div>
      {isEditing ? (
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-teal-500/20 outline-none font-semibold text-slate-700"
        />
      ) : (
        <div className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-transparent font-bold text-slate-800">
          {value || "—"}
        </div>
      )}
    </div>
  </div>
);

const StatusRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
      <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
    </div>
    <span className="text-xs font-black text-slate-800">{value}</span>
  </div>
);

export default ProfilePage;