import React, { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { Users, UserPlus, Trash2, Folder, ShieldAlert, User } from 'lucide-react';

const Groups = () => {
    const { user, isGuest } = useAuth();

    // States
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');

    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [newGroupName, setNewGroupName] = useState('');

    const [members, setMembers] = useState([]);
    const [newMemberUsername, setNewMemberUsername] = useState('');

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const currentUsername = user?.id || user?.username;

    useEffect(() => {
        if (isGuest || !currentUsername) return;

        const fetchRooms = async () => {
            try {
                const response = await axiosClient.get('/api/rooms', {
                    params: { owner: currentUsername }
                });
                setRooms(response.data);
                if (response.data.length > 0) {
                    setSelectedRoom(response.data[0].id);
                }
            } catch (error) {
                console.error("Lỗi tải phòng:", error);
            }
        };
        fetchRooms();
    }, [isGuest, currentUsername]);

    useEffect(() => {
        if (!selectedRoom) return;

        const fetchGroups = async () => {
            setLoading(true);
            try {
                const response = await axiosClient.get(`/api/rooms/${selectedRoom}/groups`);
                setGroups(response.data);
                setSelectedGroup(null);
                setMembers([]);
            } catch (error) {
                console.error("Lỗi tải nhóm:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchGroups();
    }, [selectedRoom]);

    useEffect(() => {
        if (!selectedGroup) return;

        const fetchMembers = async () => {
            try {
                const response = await axiosClient.get(`/api/groups/${selectedGroup.id}/members`);
                setMembers(response.data);
            } catch (error) {
                console.error("Lỗi tải thành viên:", error);
            }
        };
        fetchMembers();
    }, [selectedGroup]);


    const handleCreateGroup = async (e) => {
        e.preventDefault();

        // 1. Kiểm tra xem đã chọn Room chưa
        if (!selectedRoom) {
            alert("Bạn chưa chọn Không gian (Room) nào! Hãy tạo Room trước khi tạo nhóm.");
            return;
        }
        // 2. Kiểm tra tên nhóm
        if (!newGroupName.trim()) {
            alert("Vui lòng nhập tên nhóm!");
            return;
        }

        try {
            const payload = {
                name: newGroupName.trim(),
                managerUsername: currentUsername
            };

            // Gọi API
            const res =  await axiosClient.post(`/api/rooms/${selectedRoom}/groups`, payload);
            alert(`Nhóm: "${res.data.name}" đã được tạo!`);

            // Làm sạch ô input và tải lại danh sách
            setNewGroupName('');
            const refreshRes = await axiosClient.get(`/api/rooms/${selectedRoom}/groups`);
            setGroups(refreshRes.data);

        } catch (error) {
            alert("Lỗi từ máy chủ: " + (error.response?.data || error.message));
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();

        if (!selectedGroup) {
            alert("Vui lòng chọn nhóm trước!");
            return;
        }
        if (!newMemberUsername.trim()) {
            alert("Vui lòng nhập MSSV!");
            return;
        }

        setErrorMsg('');

        try {
            const payload = { username: newMemberUsername.trim() };

            const res = await axiosClient.post(`/api/groups/${selectedGroup.id}/members`, payload);
            alert(`Thêm "${res.data.name}" thành công`);
            setNewMemberUsername('');
            const refreshRes = await axiosClient.get(`/api/groups/${selectedGroup.id}/members`);
            setMembers(refreshRes.data);

        } catch (error) {
            console.error("Lỗi thêm thành viên:", error);
            // In lỗi đỏ ra giao diện thay vì console
            setErrorMsg(error.response?.data || "Không tìm thấy sinh viên hoặc sinh viên đã trong nhóm!");
        }
    };

    const handleDeleteGroup = async (groupId, e) => {
        e.stopPropagation();
        if(!window.confirm("Xóa nhóm này?")) return;
        try {
            await axiosClient.delete(`/api/groups/${groupId}`);
            if (selectedGroup?.id === groupId) {
                setSelectedGroup(null);
                setMembers([]);
            }
            setGroups(groups.filter(g => g.id !== groupId));
        } catch (error) {
            alert("Không thể xóa nhóm!");
        }
    };

    // const handleAddMember = async (e) => {
    //     e.preventDefault();
    //     if (!newMemberUsername.trim() || !selectedGroup) return;
    //     setErrorMsg('');
    //
    //     try {
    //         await axiosClient.post(`/api/groups/${selectedGroup.id}/members`, {
    //             username: newMemberUsername.trim()
    //         });
    //         setNewMemberUsername('');
    //         const response = await axiosClient.get(`/api/groups/${selectedGroup.id}/members`);
    //         setMembers(response.data);
    //     } catch (error) {
    //         setErrorMsg(error.response?.data || "Không tìm thấy sinh viên hoặc sinh viên đã trong nhóm!");
    //     }
    // };

    const handleRemoveMember = async (userId) => {
        if(!window.confirm("Xóa sinh viên này khỏi nhóm?")) return;
        try {
            await axiosClient.delete(`/api/groups/${selectedGroup.id}/members/${userId}`);
            setMembers(members.filter(m => m.userId !== userId));
        } catch (error) {
            alert("Lỗi khi xóa sinh viên!");
        }
    };

    if (isGuest) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                <ShieldAlert size={64} className="text-orange-400 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Truy cập bị từ chối</h2>
                <p className="text-gray-500 mt-2">Chế độ Khách không thể quản lý Nhóm/Lớp học.</p>
            </div>
        );
    }

    return (
        <div className="p-2 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Quản lý Lớp học & Thành viên</h2>
                    <p className="text-sm text-gray-500 mt-1">Sắp xếp sinh viên vào các nhóm để dễ dàng quản lý.</p>
                </div>

                <select
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                    className="border border-gray-300 p-2 rounded-lg font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
                >
                    <option value="" disabled>-- Chọn Không gian --</option>
                    {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            <div className="flex flex-1 gap-6 min-h-[500px]">
                <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-700 flex items-center">
                            <Folder size={18} className="mr-2" /> Danh sách Nhóm
                        </h3>
                    </div>

                    <div className="p-4 border-b border-gray-100">
                        <form onSubmit={handleCreateGroup} className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Tên nhóm mới..."
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="flex-1 border p-2 rounded outline-none text-sm focus:border-blue-500"
                            />
                            <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 font-bold text-sm">
                                Thêm
                            </button>
                        </form>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? <p className="text-center text-gray-400 mt-4">Đang tải...</p> :
                            groups.length === 0 ? <p className="text-center text-gray-400 text-sm mt-4">Chưa có nhóm nào.</p> :
                                groups.map(g => (
                                    <div
                                        key={g.id}
                                        onClick={() => setSelectedGroup(g)}
                                        className={`flex justify-between items-center p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                                            selectedGroup?.id === g.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                                        }`}
                                    >
                                        <span className="font-bold text-gray-700">{g.name}</span>
                                        <button onClick={(e) => handleDeleteGroup(g.id, e)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                    {!selectedGroup ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Users size={48} className="mb-4 text-gray-300" />
                            <p>Chọn một nhóm bên trái để xem và thêm thành viên</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 flex items-center">
                                    <Users size={18} className="mr-2" />
                                    Thành viên nhóm: <span className="text-blue-600 ml-1">{selectedGroup.name}</span>
                                </h3>
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                                    {members.length} người
                                </span>
                            </div>

                            <div className="p-4 border-b border-gray-100">
                                <form onSubmit={handleAddMember} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nhập MSSV (Username) sinh viên..."
                                        value={newMemberUsername}
                                        onChange={(e) => setNewMemberUsername(e.target.value)}
                                        className="flex-1 border p-2 rounded outline-none text-sm focus:border-blue-500"
                                    />
                                    <button type="submit" className="flex items-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold text-sm">
                                        <UserPlus size={16} className="mr-1" /> Thêm
                                    </button>
                                </form>
                                {errorMsg && <p className="text-red-500 text-xs font-bold mt-2">{errorMsg}</p>}
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {members.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm mt-4">Nhóm này chưa có thành viên nào.</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {members.map(m => (
                                            <div key={m.userId} className="flex justify-between items-center border border-gray-100 p-3 rounded-lg bg-gray-50 hover:border-blue-200 transition-colors">
                                                <div className="flex items-center">
                                                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                                                        <User size={16} className="text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{m.inAppName || 'Người dùng hệ thống'}</p>
                                                        <p className="text-xs text-gray-500">MSSV: {m.username}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleRemoveMember(m.userId)} className="text-gray-400 hover:text-red-500 p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Groups;