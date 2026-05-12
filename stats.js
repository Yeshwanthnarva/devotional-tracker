window.addEventListener("DOMContentLoaded", () => {

    const todayCountEl = document.getElementById("today-count");
    const todayMalasEl = document.getElementById("today-malas");
    const todayTimeEl = document.getElementById("today-time");
    const totalCountEl = document.getElementById("total-count");
    const totalMalasEl = document.getElementById("total-malas");
    const totalTimeEl = document.getElementById("total-time");
    const streakCountEl = document.getElementById("streak-count");
    const loadingMsg = document.getElementById("loading-msg");

    function formatTime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs > 0 ? hrs + "h " : ""}${mins}m ${secs}s`;
    }

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const japaRef = db.collection("japa").doc(user.uid).collection("daily");
        const userRef = db.collection("users").doc(user.uid);

        // ✅ REAL-TIME listener for today's stats
        japaRef.doc(today).onSnapshot((doc) => {
            if (doc.exists) {
                const count = doc.data().count || 0;
                todayCountEl.textContent = count;
                todayMalasEl.textContent = Math.floor(count / 108);
                todayTimeEl.textContent = formatTime(doc.data().time || 0);
            } else {
                todayCountEl.textContent = 0;
                todayMalasEl.textContent = 0;
                todayTimeEl.textContent = "0m 0s";
            }
            if (loadingMsg) loadingMsg.style.display = "none";
        });

        // ✅ REAL-TIME listener for overall stats
        japaRef.onSnapshot((snapshot) => {
            let totalCount = 0;
            let totalTime = 0;
            snapshot.forEach(doc => {
                totalCount += doc.data().count || 0;
                totalTime += doc.data().time || 0;
            });
            totalCountEl.textContent = totalCount;
            totalMalasEl.textContent = Math.floor(totalCount / 108);
            totalTimeEl.textContent = formatTime(totalTime);
        });

        // ✅ REAL-TIME listener for streak
        userRef.onSnapshot(async (doc) => {
            if (doc.exists) {
                const lastDate = doc.data().lastJapaDate || "";
                let streak = doc.data().streak || 0;

                // Reset streak if broken
                if (lastDate && lastDate !== today && lastDate !== yesterdayStr) {
                    streak = 0;
                    await userRef.update({ streak: 0 });
                }

                streakCountEl.textContent = streak + " Days";
            }
        });

    });

});