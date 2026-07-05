"use client";

import { useState, useEffect } from "react";
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, addDays, isSameMonth, isToday, isSameDay
} from "date-fns";
import { ChevronLeft, ChevronRight, Menu, Search, Plus } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import "./AttendanceCalendar.css"; // Import the vanilla CSS

interface Log {
  id: string;
  type: "arrived" | "departed" | "absent";
  timestamp: string;
  dateString: string;
}

interface AttendanceCalendarProps {
  studentId: string;
  studentName: string;
  onAddConsultation?: (studentId: string, date: Date) => void;
}

export default function AttendanceCalendar({ studentId, studentName, onAddConsultation }: AttendanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [logs, setLogs] = useState<Log[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  useEffect(() => {
    if (!studentId) return;
    
    const q = query(collection(db, "attendance_logs"), where("studentId", "==", studentId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData: Log[] = [];
      snapshot.forEach(doc => {
        logData.push({ id: doc.id, ...doc.data() } as Log);
      });
      setLogs(logData);
    });

    return () => unsubscribe();
  }, [studentId]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderTopBar = () => {
    return (
      <div className="calendar-top-bar">
        <div className="calendar-nav-btn">
          <ChevronLeft size={28} strokeWidth={2} onClick={prevMonth} />
          <span style={{ fontSize: '1.1rem', fontWeight: 500, margin: '0 8px' }}>{format(currentDate, "yyyy년")}</span>
          <ChevronRight size={28} strokeWidth={2} onClick={nextMonth} />
        </div>
        <div className="calendar-nav-icons">
          <Menu size={24} strokeWidth={2} />
          <Search size={24} strokeWidth={2} />
          <Plus size={28} strokeWidth={2} onClick={() => onAddConsultation && selectedDate && onAddConsultation(studentId, selectedDate)} style={{cursor: 'pointer'}} />
        </div>
      </div>
    );
  };

  const renderDaysHeader = () => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    return (
      <div className="calendar-days-row">
        {days.map((day, idx) => (
          <div key={idx} className={`calendar-day-label ${idx === 0 ? 'sunday' : idx === 6 ? 'saturday' : ''}`}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    const currentMonthLogs = logs.filter(log => log.dateString.startsWith(format(currentDate, "yyyy-MM")));
    const uniqueArrivedDays = new Set(currentMonthLogs.filter(l => l.type === "arrived").map(l => l.dateString)).size;
    
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const formattedDate = format(day, "d");
        const dateStr = format(day, "yyyy-MM-dd");
        
        const dayLogs = logs.filter(l => l.dateString === dateStr);
        dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const arrivedLog = dayLogs.find(l => l.type === "arrived");
        const absentLog = dayLogs.find(l => l.type === "absent");

        const isCurrentMonth = isSameMonth(day, monthStart);
        const isTodayDate = isToday(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);

        // Absence takes visual priority over an attendance mark on the
        // same day — it's the more important thing for a parent to notice.
        const dotVariant = absentLog ? "absent" : arrivedLog ? "attended" : null;

        let numClass = "calendar-date-num";
        if (isTodayDate) numClass += " today";
        else if (isSelected && isCurrentMonth) numClass += " selected";
        else if (!isCurrentMonth) numClass += " other-month";

        days.push(
          <div
            key={day.toString()}
            onClick={() => setSelectedDate(cloneDay)}
            className="calendar-cell"
          >
            <div className={numClass}>
              {formattedDate}
            </div>

            {dotVariant && (
              <div
                className={`calendar-event-dot ${dotVariant}`}
                style={(isTodayDate || isSelected) ? { backgroundColor: 'transparent' } : undefined}
              />
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      
      rows.push(
        <div className="calendar-grid" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div>
        <h2 className="calendar-title">
          {format(currentDate, "M월")}
        </h2>
        <div style={{ backgroundColor: 'var(--surface)' }}>
          {rows}
        </div>
        
        <div className="calendar-stats">
          <div className="calendar-stats-title">
            {studentName} 출석 통계
          </div>
          <div className="calendar-stats-desc">
            이번 달 총 출석 일수: <strong className="calendar-stats-val">{uniqueArrivedDays}일</strong>
          </div>
        </div>
      </div>
    );
  };

  const renderSelectedDateDetails = () => {
    if (!selectedDate) return null;
    
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const dayLogs = logs.filter(l => l.dateString === dateStr);
    dayLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const arrivedLog = dayLogs.find(l => l.type === "arrived");
    const departedLog = dayLogs.slice().reverse().find(l => l.type === "departed");
    const absentLog = dayLogs.find(l => l.type === "absent");

    if (!arrivedLog && !departedLog && !absentLog) {
      return (
        <div className="calendar-detail-item" style={{justifyContent: 'center'}}>
          <span style={{color: 'var(--text-muted)', fontSize: '0.875rem'}}>출결 기록이 없습니다.</span>
        </div>
      );
    }

    return (
      <div>
        {absentLog && (
          <div className="calendar-detail-item">
            <div className="calendar-detail-dot absent"></div>
            <div className="calendar-detail-text">
              <span className="calendar-detail-title">결석 처리됨</span>
              <span className="calendar-detail-time">{format(new Date(absentLog.timestamp), "a h:mm").replace('AM','오전').replace('PM','오후')}</span>
            </div>
          </div>
        )}
        {arrivedLog && (
          <div className="calendar-detail-item">
            <div className="calendar-detail-dot arrived"></div>
            <div className="calendar-detail-text">
              <span className="calendar-detail-title">등원 완료</span>
              <span className="calendar-detail-time">{format(new Date(arrivedLog.timestamp), "a h:mm").replace('AM','오전').replace('PM','오후')}</span>
            </div>
          </div>
        )}
        {departedLog && (
          <div className="calendar-detail-item">
            <div className="calendar-detail-dot departed"></div>
            <div className="calendar-detail-text">
              <span className="calendar-detail-title">하원 완료</span>
              <span className="calendar-detail-time">{format(new Date(departedLog.timestamp), "a h:mm").replace('AM','오전').replace('PM','오후')}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="calendar-wrapper">
      <div>
        {renderTopBar()}
        <div style={{padding: '0 1rem'}}>
          {renderDaysHeader()}
        </div>
        {renderCells()}
      </div>
      <div className="calendar-details">
        {renderSelectedDateDetails()}
      </div>
    </div>
  );
}
