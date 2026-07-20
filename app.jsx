import React, { useState, useMemo } from 'react';

const INITIAL_TASKS = [
  {
    id: 1,
    title: "Substructure Reinforcement Audit",
    priority: "High",
    status: "In Progress",
    owner: "Alex",
    dueDate: "2026-08-01",
    description: "Verify rebar ratios and yield stress parameters across all bent caps."
  },
  {
    id: 2,
    title: "AASHTO Railing Spec Review",
    priority: "Medium",
    status: "In Review",
    owner: "Jordan",
    dueDate: "2026-08-15",
    description: "Confirm height compliance against 10th Edition specifications."
  },
  {
    id: 3,
    title: "Bridge Deck Expansion Joint Detail",
    priority: "Low",
    status: "Todo",
    owner: "Sam",
    dueDate: "2026-09-01",
    description: "Update elastomeric joint seal dimensions in CAD template."
  }
];

export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Filter tasks dynamically based on query and priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.owner.toLowerCase().includes(search.toLowerCase()) ||
        task.description.toLowerCase().includes(search.toLowerCase());

      const matchesPriority =
        priorityFilter === "All" || task.priority === priorityFilter;

      return matchesSearch && matchesPriority;
    });
  }, [tasks, search, priorityFilter]);

  // Color helper functions
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-700 border-red-200";
      case "Medium":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Low":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
              Project Priorities & Tasks
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Shared team status dashboard and task tracker.
            </p>
          </div>
          <div className="text-sm text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm self-start md:self-auto">
            Total Tasks: <strong>{filteredTasks.length}</strong>
          </div>
        </header>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search tasks or team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Priority Filters */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">
              Priority:
            </span>
            {["All", "High", "Medium", "Low"].map((level) => (
              <button
                key={level}
                onClick={() => setPriorityFilter(level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  priorityFilter === level
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards Grid */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getPriorityBadge(task.priority)}`}>
                      {task.priority} Priority
                    </span>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {task.status}
                    </span>
                  </div>
                  <h2 className="font-bold text-slate-800 text-base mb-1">
                    {task.title}
                  </h2>
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                    {task.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Owner: <strong className="text-slate-700">{task.owner}</strong></span>
                  <span>Due: {task.dueDate}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
            <p className="text-slate-500 text-sm">No tasks match your current filters.</p>
            <button
              onClick={() => { setSearch(""); setPriorityFilter("All"); }}
              className="mt-3 text-xs text-blue-600 hover:underline font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
