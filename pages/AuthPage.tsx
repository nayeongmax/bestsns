const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const loginId = formData.id.trim();
    const loginPw = formData.pw;

    // 1. 관리자 마스터 계정 (이건 그대로 유지)
    if (loginId === 'admin' && loginPw === '1234') {
        const adminUser: UserProfile = {
            id: 'admin',
            nickname: '마케터김',
            profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=admin`,
            role: 'admin',
            email: 'admin@thebestsns.com',
            phone: '010-0000-0000',
            points: 999999,
            joinDate: '2024-01-01',
            coupons: []
        };
        onLoginSuccess(adminUser);
        navigate('/sns');
        setLoading(false);
        return;
    }

    try {
      // 2. 슈파베이스 인증 시도
      // 가입 시 이메일을 사용했으므로, 입력받은 ID가 이메일 형식이 아니면 가짜 이메일 형식을 매칭합니다.
      const loginEmail = loginId.includes('@') ? loginId : formData.email || `${loginId}@thebestsns.user`;

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPw,
      });

      if (authError) throw authError;

      // 3. 인증 성공 후, DB(profiles 테이블)에서 해당 유저의 정보(포인트 등) 가져오기
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', loginId)
        .single();

      // 4. 앱 상태 업데이트 (UserProfile 형식에 맞게 구성)
      const profile: UserProfile = {
        id: loginId,
        nickname: profileData?.nickname || authData.user.user_metadata.nickname || loginId,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginId}`,
        role: profileData?.role || 'user',
        email: authData.user.email || '',
        points: profileData?.points || 0,
        joinDate: profileData?.join_date || new Date().toISOString().split('T')[0],
        coupons: []
      };

      onLoginSuccess(profile);
      alert(`${profile.nickname}님, 반갑습니다!`);
      navigate('/sns');

    } catch (err: any) {
      console.error('Login Error:', err);
      alert(`로그인 실패: 아이디 또는 비밀번호가 일치하지 않습니다.`);
    } finally {
      setLoading(false);
    }
  };
